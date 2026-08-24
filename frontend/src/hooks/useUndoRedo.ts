import { useCallback, useEffect, useState, useRef } from "react";
import type { Node, Edge } from "reactflow";

export function useUndoRedo<TNode extends Node = Node, TEdge extends Edge = Edge>(
  nodes: TNode[],
  edges: TEdge[],
  setNodes: (nodes: TNode[] | ((prev: TNode[]) => TNode[])) => void,
  setEdges: (edges: TEdge[] | ((prev: TEdge[]) => TEdge[])) => void
) {
  const [past, setPast] = useState<{ nodes: TNode[]; edges: TEdge[] }[]>([]);
  const [future, setFuture] = useState<{ nodes: TNode[]; edges: TEdge[] }[]>([]);

  const stateRef = useRef({ nodes, edges });
  useEffect(() => {
    stateRef.current = { nodes, edges };
  }, [nodes, edges]);

  // Function to take a snapshot of the current state
  const takeSnapshot = useCallback(() => {
    // Deep clone to prevent reference mutations from affecting history
    const nodesClone = JSON.parse(JSON.stringify(stateRef.current.nodes));
    const edgesClone = JSON.parse(JSON.stringify(stateRef.current.edges));
    setPast((p) => [...p, { nodes: nodesClone, edges: edgesClone }]);
    setFuture([]); // Clear future on new action
  }, []);

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p;
      const newPast = [...p];
      const previousState = newPast.pop()!;
      
      const nodesClone = JSON.parse(JSON.stringify(stateRef.current.nodes));
      const edgesClone = JSON.parse(JSON.stringify(stateRef.current.edges));
      setFuture((f) => [{ nodes: nodesClone, edges: edgesClone }, ...f]);
      
      setNodes(previousState.nodes);
      setEdges(previousState.edges);

      return newPast;
    });
  }, [setNodes, setEdges]);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const newFuture = [...f];
      const nextState = newFuture.shift()!;
      
      const nodesClone = JSON.parse(JSON.stringify(stateRef.current.nodes));
      const edgesClone = JSON.parse(JSON.stringify(stateRef.current.edges));
      setPast((p) => [...p, { nodes: nodesClone, edges: edgesClone }]);
      
      setNodes(nextState.nodes);
      setEdges(nextState.edges);

      return newFuture;
    });
  }, [setNodes, setEdges]);

  // Handle keyboard shortcuts (Ctrl+Z, Ctrl+Y / Cmd+Shift+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (cmdOrCtrl && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          redo();
        } else {
          e.preventDefault();
          undo();
        }
      } else if (cmdOrCtrl && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return { takeSnapshot, undo, redo, canUndo: past.length > 0, canRedo: future.length > 0 };
}
