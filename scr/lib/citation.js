// scr/lib/citation.js
export function splitName(full) {
  const parts = String(full || "")
    .trim()
    .split(/\s+/);
  const family = parts.pop() || "";
  return { given: parts.join(" "), family };
}
const ini = (s) => (s ? s[0].toUpperCase() + "." : "");

function authorsAPA(list) {
  if (!list.length) return "";
  const names = list.map((n) => {
    const { given, family } = splitName(n);
    const initials = given.split(/[ -]/).filter(Boolean).map(ini).join(" ");
    return `${family}, ${initials}`.trim();
  });
  return names.length === 1
    ? names[0]
    : names.slice(0, -1).join(", ") + ", & " + names.at(-1);
}
function authorsMLA(list) {
  if (!list.length) return "";
  const [{ given, family }, ...rest] = list.map(splitName);
  if (rest.length === 0) return `${family}, ${given}`;
  if (rest.length === 1)
    return `${family}, ${given}, and ${rest[0].given} ${rest[0].family}`;
  return `${family}, ${given}, et al.`;
}
function authorsChicago(list) {
  if (!list.length) return "";
  const n = list.map((n) => {
    const { given, family } = splitName(n);
    return `${family}, ${given}`;
  });
  if (n.length === 1) return n[0];
  if (n.length === 2) return `${n[0]} and ${n[1]}`;
  return n.slice(0, -1).join(", ") + ", and " + n.at(-1);
}
const monthName = (m) => {
  const i = Number(m);
  return i >= 1 && i <= 12
    ? [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ][i - 1]
    : "";
};

export function buildCitation(data) {
  const A = (data.authors || []).filter(Boolean);
  const y = data.year || "";
  const m = monthName(data.month);
  const d = data.day ? String(data.day) : "";
  const ital = (s) => (s ? `<em>${s}</em>` : "");
  const doiOrUrl = data.doi
    ? ` https://doi.org/${data.doi.replace(/^https?:\/\/doi\.org\//i, "")}`
    : data.url
    ? ` ${data.url}`
    : "";
  const style = data.style || "apa";
  const t = data.type || "web";

  if (style === "apa") {
    if (t === "web") {
      const date = y ? ` (${y}${m ? `, ${m}` : ""}${d ? ` ${d}` : ""}).` : "";
      return `${authorsAPA(A)}${date} ${data.title}. ${data.container || ""}.${
        data.url ? ` ${data.url}` : ""
      }`;
    }
    if (t === "article") {
      const volIss = data.volume
        ? `${data.volume}${data.issue ? `(${data.issue})` : ""}`
        : "";
      const pages = data.pages ? `, ${data.pages}` : "";
      return `${authorsAPA(A)}${y ? ` (${y}).` : ""} ${data.title}. ${ital(
        data.container || ""
      )}${volIss ? `, ${volIss}` : ""}${pages}.${doiOrUrl}`;
    }
    return `${authorsAPA(A)}${y ? ` (${y}).` : ""} ${ital(data.title)}${
      data.publisher ? `. ${data.publisher}.` : ""
    }`;
  }

  if (style === "mla") {
    const date =
      d || m || y ? `${d ? d + " " : ""}${m ? m + " " : ""}${y}`.trim() : "";
    if (t === "web") {
      return `${authorsMLA(A)}. “${data.title}.” ${ital(
        data.container || ""
      )}, ${date}${data.url ? `, ${data.url}` : ""}.`;
    }
    if (t === "article") {
      const vol = data.volume ? `vol. ${data.volume}` : "";
      const iss = data.issue ? `, no. ${data.issue}` : "";
      const yr = y ? `, ${y}` : "";
      const p = data.pages ? `, pp. ${data.pages}` : "";
      return `${authorsMLA(A)}. “${data.title}.” ${ital(
        data.container || ""
      )}, ${vol}${iss}${yr}${p}.${doiOrUrl}`;
    }
    return `${authorsMLA(A)}. ${ital(data.title)}. ${
      data.publisher ? `${data.publisher}, ` : ""
    }${y || ""}.`;
  }

  // Chicago (author-date)
  const dateChi =
    d || m || y ? `${y}${m ? `. ${m}` : ""}${d ? ` ${d}` : ""}` : "";
  if (t === "web") {
    return `${authorsChicago(A)}. ${dateChi}. “${data.title}.” ${ital(
      data.container || ""
    )}.${data.url ? ` ${data.url}.` : ""}`;
  }
  if (t === "article") {
    const vol = data.volume ? `${data.volume}` : "";
    const iss = data.issue ? `, no. ${data.issue}` : "";
    const p = data.pages ? `: ${data.pages}` : "";
    return `${authorsChicago(A)}. ${dateChi}. "${data.title}." ${ital(
      data.container || ""
    )} ${vol}${iss}${p}.${doiOrUrl}`;
  }
  // Book fallback
  return `${authorsChicago(A)}. ${dateChi}. ${ital(data.title)}. ${
    data.publisher ? `${data.publisher}.` : ""
  }`;
}
