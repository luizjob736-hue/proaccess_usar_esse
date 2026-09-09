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
    try {
      if (child.parentNode === this) {
        return originalRemoveChild.call(this, child) as T;
      }
      if (child.parentNode) {
        try {
          return originalRemoveChild.call(child.parentNode, child) as T;
        } catch {
          // Swallow any parent-child removal mismatch
        }
      }
      return child;
    } catch {
      try {
        if (child.parentNode) {
          return originalRemoveChild.call(child.parentNode, child) as T;
        }
      } catch {
        // Ignore
      }
      return child;
    }
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(
    newNode: T,
    referenceNode: Node | null,
  ): T {
    if (!newNode) return newNode;
    try {
      if (!referenceNode || referenceNode.parentNode === this) {
        return originalInsertBefore.call(this, newNode, referenceNode) as T;
      }
      if (referenceNode.parentNode) {
        try {
          return originalInsertBefore.call(referenceNode.parentNode, newNode, referenceNode) as T;
        } catch {
          // Fallback to appendChild
        }
      }
      return this.appendChild(newNode);
    } catch {
      try {
        return this.appendChild(newNode);
      } catch {
        return newNode;
      }
    }
  };

  const originalReplaceChild = Node.prototype.replaceChild;
  Node.prototype.replaceChild = function <T extends Node>(newChild: Node, oldChild: T): T {
    if (!newChild || !oldChild) return oldChild;
    try {
      if (oldChild.parentNode === this) {
        return originalReplaceChild.call(this, newChild, oldChild) as T;
      }
      if (oldChild.parentNode) {
        try {
          return originalReplaceChild.call(oldChild.parentNode, newChild, oldChild) as T;
        } catch {
          // Fallback
        }
      }
      try {
        this.appendChild(newChild);
      } catch {
        // Ignore
      }
      return oldChild;
    } catch {
      try {
        this.appendChild(newChild);
      } catch {
        // Ignore
      }
      return oldChild;
    }
  };

  // Also protect Element prototype if it has own implementations
  if (typeof Element !== "undefined") {
    if (Element.prototype.removeChild !== Node.prototype.removeChild) {
      Element.prototype.removeChild = Node.prototype.removeChild;
    }
    if (Element.prototype.insertBefore !== Node.prototype.insertBefore) {
      Element.prototype.insertBefore = Node.prototype.insertBefore;
    }
    if (Element.prototype.replaceChild !== Node.prototype.replaceChild) {
      Element.prototype.replaceChild = Node.prototype.replaceChild;
    }
  }
}
