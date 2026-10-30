import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { posix } from "node:path";
import { createHash } from "node:crypto";
import { format } from "prettier";

const root = new URL("../../", import.meta.url);
const names = [
  "README.md",
  "docs/ENGINEERING.md",
  "research/EVIDENCE.md",
  "PROOF_OF_READY_IMPLEMENTATION_PLAN.md",
  "PROOF_OF_READY_AGENT_HANDOFF.md",
  "application/firmware/README.md",
  "application/mobile/README.md",
  "AGENTS.md",
  "application/api3/README.md",
];
const docs = Object.fromEntries(
  names.map((name) => [name, readFileSync(new URL(name, root), "utf8")]),
);
const escape = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const section = (name, title) => {
  const text = docs[name];
  const marker = `## ${title}\n`;
  const start = text.indexOf(marker);
  if (start < 0) throw new Error(`Missing canonical section: ${title}`);
  const end = text.indexOf("\n## ", start + marker.length);
  return text.slice(start + marker.length, end < 0 ? undefined : end).trim();
};
const documentId = (name) => `document-${names.indexOf(name)}`;
const download = (text, type = "text/markdown") =>
  `data:${type};base64,${Buffer.from(text).toString("base64")}`;
const combined =
  "# Proof of Ready documentation export\n\nGenerated snapshot. Edit the original repository documents, then regenerate.\n\n" +
  names
    .map((name) => `<!-- Source: ${name} -->\n\n${docs[name]}`)
    .join("\n\n---\n\n");
const inline = (value) =>
  escape(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, path) => {
      const [document] = path.split("#", 1);
      const target = names.includes(document)
        ? `#${documentId(document)}`
        : path.startsWith("application/public/")
          ? path.slice("application/public".length)
          : /^https?:\/\//.test(path)
            ? path
            : "#sources";
      return `<a href="${target}">${label}</a>`;
    });
// A deliberately small renderer for trusted repository prose. Raw HTML stays escaped.
function markdown(text) {
  const lines = text.split("\n");
  const output = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    if (line.startsWith("```")) {
      const code = [];
      while (++i < lines.length && !lines[i].startsWith("```"))
        code.push(lines[i]);
      output.push(`<pre><code>${escape(code.join("\n"))}</code></pre>`);
      continue;
    }
    if (line.startsWith("|")) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        if (!/^\|[\s:|-]+\|$/.test(lines[i]))
          rows.push(
            lines[i]
              .slice(1, -1)
              .split("|")
              .map((v) => v.trim()),
          );
        i++;
      }
      i--;
      output.push(
        `<div class="table-scroll"><table><thead><tr>${rows[0].map((v) => `<th scope="col">${inline(v)}</th>`).join("")}</tr></thead><tbody>${rows
          .slice(1)
          .map(
            (row) =>
              `<tr>${row.map((v) => `<td>${inline(v)}</td>`).join("")}</tr>`,
          )
          .join("")}</tbody></table></div>`,
      );
      continue;
    }
    const list = /^(?:- |\d+\. )/.test(line);
    if (list) {
      const ordered = /^\d/.test(line),
        tag = ordered ? "ol" : "ul",
        items = [];
      while (i < lines.length && /^(?:- |\d+\. )/.test(lines[i]))
        items.push(
          `<li>${inline(lines[i++].replace(/^(?:- |\d+\. )/, ""))}</li>`,
        );
      i--;
      output.push(`<${tag}>${items.join("")}</${tag}>`);
      continue;
    }
    if (line.startsWith("### ")) {
      output.push(`<h3>${inline(line.slice(4))}</h3>`);
      continue;
    }
    const paragraph = [line];
    while (
      i + 1 < lines.length &&
      lines[i + 1].trim() &&
      !/^(?:#|\||```|- |\d+\. )/.test(lines[i + 1])
    )
      paragraph.push(lines[++i]);
    output.push(`<p>${inline(paragraph.join(" "))}</p>`);
  }
  return output.join("\n");
}
const intro = docs["README.md"].split("\n## ")[0].replace(/^# [^\n]+\n/, "");
const implementation = section(
  "research/EVIDENCE.md",
  "Current local implementation evidence",
);
const reproduction = implementation.indexOf("Reproduce from");
if (reproduction < 0)
  throw new Error(
    "The canonical verification section lacks reproduction commands.",
  );
const evidenceSummary = implementation.slice(0, reproduction);
const evidenceDetails = implementation.slice(reproduction);
const sources = names
  .map((name) => {
    const digest = createHash("sha256").update(docs[name]).digest("hex");
    return `<li><a href="#${documentId(name)}">${escape(name)}</a><code title="SHA-256 of canonical source">${digest}</code></li>`;
  })
  .join("");
const fullDocuments = names
  .map(
    (name) =>
      `<details id="${documentId(name)}"><summary>${escape(name)}</summary><p><a download="${escape(name.replaceAll("/", "-"))}" href="${download(docs[name])}">Download original Markdown</a></p><pre class="document-source"><code>${escape(docs[name])}</code></pre></details>`,
  )
  .join("\n");
const css = readFileSync(
  new URL("../public/overview.css", import.meta.url),
  "utf8",
);
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Proof of Ready · project overview</title><style>${css}</style></head><body id="top">
<header><a class="brand" href="#top">Proof of Ready <span>LOCAL PROJECT OVERVIEW</span></a><nav aria-label="Project"><a href="#capabilities">Capabilities</a><a href="#evidence">Evidence</a><a href="#next">Next actions</a><a href="#documents">Full documents</a><a download="proof-of-ready-context.md" href="${download(combined)}">Export Markdown</a></nav></header>
<main><section class="intro"><p class="eyebrow">Commissioning / evidence / acceptance</p><h1>Prove the installation.<br>Expose the missing evidence.</h1>${markdown(intro)}</section>
<aside class="evidence-strip" aria-label="Acceptance requirements"><span>Approved work order</span><b aria-hidden="true">→</b><span>Fresh physical evidence</span><b aria-hidden="true">→</b><span>Delivered paid inspection</span><b aria-hidden="true">→</b><span>Pinned policy decision</span></aside>
<section id="capabilities"><div class="section-heading"><p class="eyebrow">Current implementation</p><h2>What runs. What still needs evidence.</h2></div>${markdown(section("README.md", "Integration status"))}</section>
<section id="hardware"><p class="eyebrow">Owner-confirmed resources</p><h2>Use the hardware that is already available.</h2>${markdown(section("research/EVIDENCE.md", "Available hardware"))}</section>
<div class="columns"><section id="evidence"><p class="eyebrow">Verified checks</p><h2>Local evidence has a defined scope.</h2>${markdown(evidenceSummary)}<details><summary>Commands, provenance, and remaining evidence</summary>${markdown(evidenceDetails)}</details></section>
<section id="next"><p class="eyebrow">Next actions</p><h2>Use the working path.</h2>${markdown(section("README.md", "Owner actions on the critical path"))}<details><summary>Further execution context</summary>${markdown(section("README.md", "Current execution index"))}</details><details><summary>Owner inputs and external actions</summary>${markdown(section("PROOF_OF_READY_IMPLEMENTATION_PLAN.md", "Owner decisions and preparation"))}</details></section></div>
<section class="run"><p class="eyebrow">Reproduce</p><h2>Open the station. Inspect a defect.</h2>${markdown(section("README.md", "Run the commissioning station"))}<div class="links"><a href="http://127.0.0.1:4021/mobile/">Seeker setup ↗</a><a download="proof-ready-target.svg" href="${download(readFileSync(new URL("../public/vision/target.svg", import.meta.url)), "image/svg+xml")}">Printable marker target ↗</a><a href="http://127.0.0.1:4021/observation.html">Retained observation lab ↗</a></div></section>
<section><details><summary>Coordinator interface and recovery</summary>${markdown(section("docs/ENGINEERING.md", "Commissioning HTTP interface"))}</details></section>
<section id="documents"><p class="eyebrow">Complete offline context</p><h2>Full Markdown documents</h2><p>All nine source documents are embedded below. Expand a document to read or download its original Markdown. External services, source code, and the running station remain separate.</p>${fullDocuments}</section>
<section id="sources"><p class="eyebrow">Canonical source snapshot</p><h2>Generated from the current project documents.</h2><p>Run <code>npm run overview</code> after documentation changes. These source hashes identify this snapshot. They do not certify the claims.</p><ul class="sources">${sources}</ul></section>
</main><footer>Private local development · No public submission or deployment · No fixture proves physical acceptance or live settlement.</footer></body></html>\n`;
const formatted = await format(html, { parser: "html" });
// Export only the explicit document set and repository files linked by those documents.
// Never traverse ignored originals, runtime directories, or credential configuration.
const files = Object.fromEntries(
  names.map((name) => [name, Buffer.from(docs[name])]),
);
const allowed = new Set(
  execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: root, encoding: "utf8" },
  ).split("\0"),
);
for (const name of names) {
  const prose = docs[name].replace(/```[\s\S]*?```/g, "");
  for (const match of prose.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = match[1].replace(/^<|>$/g, "").split("#", 1)[0];
    if (!target || /^[a-z]+:/i.test(target)) continue;
    const path = posix.normalize(
      posix.join(posix.dirname(name), decodeURIComponent(target)),
    );
    if (!allowed.has(path) || path.startsWith("../")) continue;
    files[path] = readFileSync(new URL(path, root));
  }
}
files["overview.html"] = Buffer.from(formatted);
files["overview.md"] = Buffer.from(combined);
files["manifest.json"] = Buffer.from(
  JSON.stringify(
    {
      schema: "proof-of-ready/documentation-export/v1",
      documents: names,
      files: Object.fromEntries(
        Object.entries(files).map(([name, bytes]) => [
          name,
          createHash("sha256").update(bytes).digest("hex"),
        ]),
      ),
    },
    null,
    2,
  ) + "\n",
);
const zip = execFileSync(
  "python3",
  [
    "-c",
    `import sys,json,base64,zipfile,io
files=json.load(sys.stdin)
out=io.BytesIO()
with zipfile.ZipFile(out,'w',compression=zipfile.ZIP_DEFLATED) as archive:
 for name,data in sorted(files.items()):
  info=zipfile.ZipInfo(name,date_time=(1980,1,1,0,0,0))
  info.compress_type=zipfile.ZIP_DEFLATED
  info.external_attr=0o600 << 16
  archive.writestr(info,base64.b64decode(data))
sys.stdout.buffer.write(out.getvalue())`,
  ],
  {
    input: JSON.stringify(
      Object.fromEntries(
        Object.entries(files).map(([name, bytes]) => [
          name,
          bytes.toString("base64"),
        ]),
      ),
    ),
    maxBuffer: 16 * 1024 * 1024,
  },
);
for (const [name, bytes] of [
  ["overview.html", Buffer.from(formatted)],
  ["overview.md", Buffer.from(combined)],
  ["overview-export.zip", zip],
]) {
  const output = new URL(`../public/${name}`, import.meta.url);
  if (process.argv.includes("--check")) {
    if (!readFileSync(output).equals(bytes))
      throw new Error(`Stale ${name}. Run npm run overview.`);
  } else writeFileSync(output, bytes);
}
console.log(
  `Documentation ${process.argv.includes("--check") ? "verified" : "generated"}: standalone HTML, combined Markdown, and ZIP with ${names.length} source documents.`,
);
