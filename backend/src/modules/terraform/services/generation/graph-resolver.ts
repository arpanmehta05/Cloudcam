/**
 * Topological Sort and Dependency Resolver for Terraform Resources
 */

export interface ResourceNode {
  id: string;
  type: string;
  name: string;
  dependencies: string[]; // addresses of other resources
  data: any;
  nestedBlocks?: string[]; // keys in `data` that should be rendered as nested blocks (no =)
}

export function topologicalSort(nodes: ResourceNode[]): ResourceNode[] {
  const sorted: ResourceNode[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  const nodeMap = new Map(nodes.map(n => [`${n.type}.${n.name}`, n]));

  function visit(address: string) {
    if (visiting.has(address)) {
      throw new Error(`Circular dependency detected: ${address}`);
    }
    if (!visited.has(address)) {
      visiting.add(address);
      const node = nodeMap.get(address);
      if (node) {
        for (const dep of node.dependencies) {
          visit(dep);
        }
        sorted.push(node);
      }
      visiting.delete(address);
      visited.add(address);
    }
  }

  for (const node of nodes) {
    visit(`${node.type}.${node.name}`);
  }

  return sorted;
}

export function resolveInterpolation(type: string, name: string, attr: string): string {
  return `\${${type}.${name}.${attr}}`;
}
