/**
 * Deterministic HCL (HashiCorp Configuration Language) Generator
 */

export type HclValue = string | number | boolean | null | HclValue[] | { [key: string]: HclValue };

export class HclBuilder {
  private static indent(level: number): string {
    return "  ".repeat(level);
  }

  private static escapeString(v: string): string {
    let result = "";
    let i = 0;
    while (i < v.length) {
      if (v.substring(i, i + 2) === "${") {
        // Scan the interpolation block
        let depth = 1;
        let j = i + 2;
        while (j < v.length && depth > 0) {
          if (v[j] === '"') {
            // Scan string literal inside interpolation to avoid picking up '}' or '${' inside it
            j++;
            while (j < v.length) {
              if (v[j] === '"') {
                j++;
                break;
              }
              if (v[j] === '\\') {
                j += 2; // skip escaped char
              } else {
                j++;
              }
            }
          } else if (v.substring(j, j + 2) === "${") {
            depth++;
            j += 2;
          } else if (v[j] === "}") {
            depth--;
            j++;
          } else {
            j++;
          }
        }
        result += v.substring(i, j);
        i = j;
      } else {
        const char = v[i];
        if (char === "\\") {
          result += "\\\\";
        } else if (char === '"') {
          result += '\\"';
        } else {
          result += char;
        }
        i++;
      }
    }
    return result;
  }

  private static formatValue(v: HclValue, depth: number): string {
    if (v === null || v === undefined) return "null";
    if (typeof v === "boolean") return v ? "true" : "false";
    if (typeof v === "number") return String(v);

    if (typeof v === "string") {
      // Handle Terraform interpolations ${...}; do not quote pure interpolations.
      if (v.startsWith("${") && v.endsWith("}")) {
        return v.slice(2, -1);
      }
      if (v.includes("\n")) {
        const trimmed = v.endsWith("\n") ? v.slice(0, -1) : v;
        return `<<TF_EOF\n${trimmed}\nTF_EOF`;
      }
      return `"${this.escapeString(v)}"`;
    }

    if (Array.isArray(v)) {
      if (v.length === 0) return "[]";
      const items = v.map((item) => this.formatValue(item, depth)).join(", ");
      return `[${items}]`;
    }

    if (typeof v === "object") {
      const entries = Object.entries(v);
      if (entries.length === 0) return "{}";
      const lines = entries.map(([k, val]) => `${this.indent(depth + 1)}${k} = ${this.formatValue(val, depth + 1)}`);
      return "{\n" + lines.join("\n") + "\n" + this.indent(depth) + "}";
    }

    return String(v);
  }

  private static renderBodyEntries(body: Record<string, HclValue>, nestedBlocks: string[], depth: number): string[] {
    const lines: string[] = [];

    for (const [key, value] of Object.entries(body)) {
      if (value === undefined) continue;

      if (key === "provisioner" && Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === "object" && item !== null) {
            const entries = Object.entries(item);
            for (const [provType, provConfig] of entries) {
              lines.push(`${this.indent(depth)}provisioner "${provType}" {`);
              lines.push(...this.renderBodyEntries(provConfig as Record<string, HclValue>, nestedBlocks, depth + 1));
              lines.push(`${this.indent(depth)}}`);
            }
          }
        }
        continue;
      }

      if (nestedBlocks.includes(key) && typeof value === "object" && value !== null && !Array.isArray(value)) {
        lines.push(`${this.indent(depth)}${key} {`);
        lines.push(...this.renderBodyEntries(value as Record<string, HclValue>, nestedBlocks, depth + 1));
        lines.push(`${this.indent(depth)}}`);
        continue;
      }

      if (Array.isArray(value) && value.length > 0 && typeof value[0] === "object") {
        for (const item of value) {
          lines.push(`${this.indent(depth)}${key} {`);
          lines.push(...this.renderBodyEntries(item as Record<string, HclValue>, nestedBlocks, depth + 1));
          lines.push(`${this.indent(depth)}}`);
        }
      } else {
        lines.push(`${this.indent(depth)}${key} = ${this.formatValue(value, depth)}`);
      }
    }

    return lines;
  }

  /**
   * Generates a block of HCL.
   * `nestedBlocks` lists keys whose values should be emitted as nested blocks
   * instead of `key = { ... }` assignments.
   */
  public static generateBlock(type: string, labels: string[], body: Record<string, HclValue>, nestedBlocks: string[] = []): string {
    const labelStr = labels.length > 0 ? labels.map(l => `"${l}"`).join(" ") + " " : "";
    const header = `${type} ${labelStr}{`.replace(/\s+{$/, " {");
    const lines = this.renderBodyEntries(body, nestedBlocks, 1);

    return `${header}\n${lines.join("\n")}\n}`;
  }

  public static generateFile(blocks: string[]): string {
    return blocks.join("\n\n") + "\n";
  }
}
