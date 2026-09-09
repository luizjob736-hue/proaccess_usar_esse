import { Buffer } from "buffer";

if (typeof globalThis !== "undefined") {
  if (typeof (globalThis as any).Buffer === "undefined") {
    (globalThis as any).Buffer = Buffer;
  }
  if (typeof (globalThis as any).global === "undefined") {
    (globalThis as any).global = globalThis;
  }
}

if (typeof window !== "undefined") {
  if (typeof (window as any).Buffer === "undefined") {
    (window as any).Buffer = Buffer;
  }
  if (typeof (window as any).global === "undefined") {
    (window as any).global = window;
  }
}

// Polyfill to prevent React crashes caused by Google Translate, browser extensions,
// or DOM portal unmount race conditions (NotFoundError: The node to be removed is not a child of this node)
if (typeof window !== "undefined" && typeof Node !== "undefined") {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    if (!child) return child;
    if (child.parentNode !== this) {
      if (child.parentNode) {
        return child.parentNode.removeChild(child);
      }
      return child;
    }
    try {
      return originalRemoveChild.call(this, child) as T;
    } catch (err: any) {
      if (err?.name === "NotFoundError" || String(err?.message || "").includes("not a child")) {
        if (child.parentNode) {
          return child.parentNode.removeChild(child);
        }
        return child;
      }
      throw err;
    }
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(
    newNode: T,
    referenceNode: Node | null,
  ): T {
    if (!newNode) return newNode;
    if (referenceNode && referenceNode.parentNode !== this) {
      if (referenceNode.parentNode) {
        return referenceNode.parentNode.insertBefore(newNode, referenceNode);
      }
      return this.appendChild(newNode);
    }
    try {
      return originalInsertBefore.call(this, newNode, referenceNode) as T;
    } catch (err: any) {
      if (err?.name === "NotFoundError" || String(err?.message || "").includes("not a child")) {
        if (referenceNode && referenceNode.parentNode) {
          return referenceNode.parentNode.insertBefore(newNode, referenceNode);
        }
        return this.appendChild(newNode);
      }
      throw err;
    }
  };

  const originalReplaceChild = Node.prototype.replaceChild;
  Node.prototype.replaceChild = function <T extends Node>(newChild: Node, oldChild: T): T {
    if (!newChild || !oldChild) return oldChild;
    if (oldChild.parentNode !== this) {
      if (oldChild.parentNode) {
        return oldChild.parentNode.replaceChild(newChild, oldChild) as T;
      }
      this.appendChild(newChild);
      return oldChild;
    }
    try {
      return originalReplaceChild.call(this, newChild, oldChild) as T;
    } catch (err: any) {
      if (err?.name === "NotFoundError" || String(err?.message || "").includes("not a child")) {
        if (oldChild.parentNode) {
          return oldChild.parentNode.replaceChild(newChild, oldChild) as T;
        }
        this.appendChild(newChild);
        return oldChild;
      }
      throw err;
    }
  };
}
