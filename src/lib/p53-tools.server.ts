/* eslint-disable @typescript-eslint/no-explicit-any */
import { tool } from "ai";
import { z } from "zod";

const UA = { "User-Agent": "p53-research-assistant/1.0", Accept: "application/json" };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getJson(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, headers: { ...UA, ...(init?.headers ?? {}) } });
  if (!res.ok) {
    throw new Error(`Request failed (${res.status}) for ${new URL(url).host}`);
  }
  return res.json() as Promise<any>;
}

/** Everything is scoped to TP53/p53 — user terms are combined with the gene. */
function scope(term: string | null) {
  const t = (term ?? "").trim();
  const base = "(TP53 OR p53)";
  return t ? `${base} AND (${t})` : base;
}

export const searchClinicalTrials = tool({
  description:
    "Search ClinicalTrials.gov for TP53/p53-related interventional or observational studies (mutant p53 reactivators, MDM2 inhibitors, gene therapy, TP53-mutated cancers).",
  inputSchema: z.object({
    query: z.string().describe("Free-text terms, e.g. 'MDM2 inhibitor AML' or 'mutant p53 reactivator'"),
    status: z
      .enum(["RECRUITING", "ACTIVE_NOT_RECRUITING", "COMPLETED", "NOT_YET_RECRUITING", "ANY"])
      .nullable()
      .describe("Recruitment status filter, or ANY/null for no filter"),
  }),
  execute: async ({ query, status }) => {
    const params = new URLSearchParams({
      "query.term": scope(query),
      pageSize: "10",
      format: "json",
      fields:
        "NCTId,BriefTitle,OverallStatus,Phase,Condition,InterventionName,StartDate,LeadSponsorName",
    });
    if (status && status !== "ANY") params.set("filter.overallStatus", status);
    const data: any = (await getJson(
      `https://clinicaltrials.gov/api/v2/studies?${params.toString()}`,
    )) as { studies?: any[] };

    return {
      count: data.studies?.length ?? 0,
      trials: (data.studies ?? []).map((s: any) => {
        const p = s.protocolSection ?? {};
        const id = p.identificationModule?.nctId;
        return {
          nctId: id,
          title: p.identificationModule?.briefTitle,
          status: p.statusModule?.overallStatus,
          phase: p.designModule?.phases?.join(", "),
          conditions: p.conditionsModule?.conditions?.slice(0, 5),
          interventions: (p.armsInterventionsModule?.interventions ?? [])
            .map((i: any) => i.name)
            .slice(0, 5),
          sponsor: p.sponsorCollaboratorsModule?.leadSponsor?.name,
          url: id ? `https://clinicaltrials.gov/study/${id}` : undefined,
        };
      }),
    };
  },
});

export const searchLiterature = tool({
  description:
    "Search Europe PMC (PubMed + preprints) for peer-reviewed TP53/p53 literature: mechanisms, treatments, drug repurposing, resistance, prognosis.",
  inputSchema: z.object({
    query: z.string().describe("Topic terms, e.g. 'APR-246 ovarian cancer' or 'p53 drug repurposing'"),
    openAccessOnly: z.boolean().nullable(),
  }),
  execute: async ({ query, openAccessOnly }) => {
    const q = `${scope(query)}${openAccessOnly ? " AND OPEN_ACCESS:y" : ""}`;
    const params = new URLSearchParams({
      query: q,
      format: "json",
      pageSize: "10",
      resultType: "core",
      sort: "CITED desc",
    });
    const data: any = (await getJson(
      `https://www.ebi.ac.uk/europepmc/webservices/rest/search?${params.toString()}`,
    )) as { resultList?: { result?: any[] } };

    return {
      papers: (data.resultList?.result ?? []).map((r: any) => ({
        title: r.title,
        authors: r.authorString,
        journal: r.journalInfo?.journal?.title ?? r.bookOrReportDetails?.publisher,
        year: r.pubYear,
        citations: r.citedByCount,
        pmid: r.pmid,
        doi: r.doi,
        abstract: typeof r.abstractText === "string" ? r.abstractText.slice(0, 900) : undefined,
        url: r.doi ? `https://doi.org/${r.doi}` : r.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/` : undefined,
      })),
    };
  },
});

export const searchStructures = tool({
  description:
    "Search the RCSB Protein Data Bank for experimental p53 structures (DNA-binding domain, tetramerization domain, MDM2 complexes, mutant/stabilizer complexes). Returns PDB IDs usable for 3D ribbon viewing.",
  inputSchema: z.object({
    query: z
      .string()
      .describe("Structure topic, e.g. 'p53 DNA binding domain Y220C' or 'p53 MDM2 complex'"),
  }),
  execute: async ({ query }) => {
    const payload = {
      query: {
        type: "group",
        logical_operator: "and",
        nodes: [
          { type: "terminal", service: "full_text", parameters: { value: scope(query) } },
        ],
      },
      return_type: "entry",
      request_options: { paginate: { start: 0, rows: 8 } },
    };
    const search = (await getJson(
      `https://search.rcsb.org/rcsbsearch/v2/query?json=${encodeURIComponent(JSON.stringify(payload))}`,
    )) as { result_set?: Array<{ identifier: string }> };

    const ids = (search.result_set ?? []).map((r) => r.identifier);
    const entries = await Promise.all(
      ids.map(async (id) => {
        try {
          const e = (await getJson(`https://data.rcsb.org/rest/v1/core/entry/${id}`)) as any;
          return {
            pdbId: id,
            title: e.struct?.title,
            method: e.exptl?.[0]?.method,
            resolution: e.rcsb_entry_info?.resolution_combined?.[0],
            released: e.rcsb_accession_info?.initial_release_date?.slice(0, 10),
            viewerUrl: `https://www.rcsb.org/3d-view/${id}`,
            url: `https://www.rcsb.org/structure/${id}`,
          };
        } catch {
          return { pdbId: id, url: `https://www.rcsb.org/structure/${id}` };
        }
      }),
    );
    return { structures: entries };
  },
});

export const searchDrugs = tool({
  description:
    "Look up drugs and compounds relevant to p53 biology in openFDA drug labels (approved products) — useful for repurposing questions and for checking what is already marketed.",
  inputSchema: z.object({
    drugOrTarget: z
      .string()
      .describe("Drug name or target, e.g. 'idasanutlin', 'MDM2', 'arsenic trioxide'"),
  }),
  execute: async ({ drugOrTarget }) => {
    const term = drugOrTarget.replace(/[^\w\s-]/g, " ").trim();
    const params = new URLSearchParams({
      search: `openfda.generic_name:"${term}" OR openfda.brand_name:"${term}" OR description:"${term}"`,
      limit: "5",
    });
    try {
      const data: any = (await getJson(`https://api.fda.gov/drug/label.json?${params.toString()}`)) as {
        results?: any[];
      };
      return {
        labels: (data.results ?? []).map((r: any) => ({
          brandNames: r.openfda?.brand_name?.slice(0, 3),
          genericNames: r.openfda?.generic_name?.slice(0, 3),
          manufacturer: r.openfda?.manufacturer_name?.[0],
          indications: r.indications_and_usage?.[0]?.slice(0, 700),
          mechanism: r.mechanism_of_action?.[0]?.slice(0, 700),
        })),
      };
    } catch {
      return { labels: [], note: "No approved FDA label found; likely investigational." };
    }
  },
});

export const getP53GeneFacts = tool({
  description:
    "Fetch curated reference facts about the TP53 gene / p53 protein from UniProt (P04637): function, domains, sequence length, disease annotations, key variants.",
  inputSchema: z.object({
    focus: z
      .string()
      .nullable()
      .describe("Optional aspect to emphasise, e.g. 'domains' or 'variants'"),
  }),
  execute: async () => {
    const e = (await getJson(
      "https://rest.uniprot.org/uniprotkb/P04637?fields=protein_name,length,cc_function,ft_domain,ft_region,cc_disease,cc_subunit,gene_names",
    )) as any;
    const comments = (e.comments ?? []) as any[];
    const text = (type: string) =>
      comments
        .filter((c) => c.commentType === type)
        .flatMap((c) => (c.texts ?? []).map((t: any) => t.value))
        .slice(0, 4);
    return {
      accession: "P04637",
      gene: e.genes?.[0]?.geneName?.value ?? "TP53",
      proteinName: e.proteinDescription?.recommendedName?.fullName?.value,
      length: e.sequence?.length ?? 393,
      function: text("FUNCTION"),
      subunit: text("SUBUNIT"),
      diseases: comments
        .filter((c) => c.commentType === "DISEASE")
        .map((c) => c.disease?.diseaseId)
        .filter(Boolean)
        .slice(0, 12),
      features: (e.features ?? [])
        .slice(0, 15)
        .map((f: any) => `${f.type} ${f.location?.start?.value}-${f.location?.end?.value}: ${f.description ?? ""}`),
      url: "https://www.uniprot.org/uniprotkb/P04637/entry",
    };
  },
});

export const p53Tools = {
  searchClinicalTrials,
  searchLiterature,
  searchStructures,
  searchDrugs,
  getP53GeneFacts,
};
