import { useState } from "react";

import type { CodeSample, Platform } from "../types/guide";

type CodeBlockProps = {
  sample: CodeSample;
  platform: Platform;
};

export function CodeBlock({ sample, platform }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const code = platform === "bash" && sample.bashCode ? sample.bashCode : sample.code;
  const label = platform === "bash" && sample.bashCode && sample.label === "PowerShell"
    ? "Bash"
    : sample.label;

  async function copyCode() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <figure className="code-sample">
      <figcaption>
        <span>{label}</span>
        <button className="copy-button" type="button" onClick={copyCode}>
          {copied ? "Copied" : "Copy"}
        </button>
      </figcaption>
      <pre>
        <code data-language={sample.language}>{code}</code>
      </pre>
      <span className="sr-only" aria-live="polite">
        {copied ? `${label} copied to clipboard` : ""}
      </span>
    </figure>
  );
}
