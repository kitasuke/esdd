import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/yaml/dist/nodes/identity.js
var require_identity = __commonJS({
  "node_modules/yaml/dist/nodes/identity.js"(exports) {
    "use strict";
    var ALIAS = Symbol.for("yaml.alias");
    var DOC = Symbol.for("yaml.document");
    var MAP = Symbol.for("yaml.map");
    var PAIR = Symbol.for("yaml.pair");
    var SCALAR = Symbol.for("yaml.scalar");
    var SEQ = Symbol.for("yaml.seq");
    var NODE_TYPE = Symbol.for("yaml.node.type");
    var isAlias = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === ALIAS;
    var isDocument = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === DOC;
    var isMap2 = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === MAP;
    var isPair = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === PAIR;
    var isScalar2 = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SCALAR;
    var isSeq2 = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SEQ;
    function isCollection(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case MAP:
          case SEQ:
            return true;
        }
      return false;
    }
    function isNode(node) {
      if (node && typeof node === "object")
        switch (node[NODE_TYPE]) {
          case ALIAS:
          case MAP:
          case SCALAR:
          case SEQ:
            return true;
        }
      return false;
    }
    var hasAnchor = (node) => (isScalar2(node) || isCollection(node)) && !!node.anchor;
    exports.ALIAS = ALIAS;
    exports.DOC = DOC;
    exports.MAP = MAP;
    exports.NODE_TYPE = NODE_TYPE;
    exports.PAIR = PAIR;
    exports.SCALAR = SCALAR;
    exports.SEQ = SEQ;
    exports.hasAnchor = hasAnchor;
    exports.isAlias = isAlias;
    exports.isCollection = isCollection;
    exports.isDocument = isDocument;
    exports.isMap = isMap2;
    exports.isNode = isNode;
    exports.isPair = isPair;
    exports.isScalar = isScalar2;
    exports.isSeq = isSeq2;
  }
});

// node_modules/yaml/dist/visit.js
var require_visit = __commonJS({
  "node_modules/yaml/dist/visit.js"(exports) {
    "use strict";
    var identity = require_identity();
    var BREAK = Symbol("break visit");
    var SKIP = Symbol("skip children");
    var REMOVE = Symbol("remove node");
    function visit(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = visit_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        visit_(null, node, visitor_, Object.freeze([]));
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    function visit_(key, node, visitor, path) {
      const ctrl = callVisitor(key, node, visitor, path);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path, ctrl);
        return visit_(key, ctrl, visitor, path);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path = Object.freeze(path.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = visit_(i, node.items[i], visitor, path);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path = Object.freeze(path.concat(node));
          const ck = visit_("key", node.key, visitor, path);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = visit_("value", node.value, visitor, path);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    async function visitAsync(node, visitor) {
      const visitor_ = initVisitor(visitor);
      if (identity.isDocument(node)) {
        const cd = await visitAsync_(null, node.contents, visitor_, Object.freeze([node]));
        if (cd === REMOVE)
          node.contents = null;
      } else
        await visitAsync_(null, node, visitor_, Object.freeze([]));
    }
    visitAsync.BREAK = BREAK;
    visitAsync.SKIP = SKIP;
    visitAsync.REMOVE = REMOVE;
    async function visitAsync_(key, node, visitor, path) {
      const ctrl = await callVisitor(key, node, visitor, path);
      if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
        replaceNode(key, path, ctrl);
        return visitAsync_(key, ctrl, visitor, path);
      }
      if (typeof ctrl !== "symbol") {
        if (identity.isCollection(node)) {
          path = Object.freeze(path.concat(node));
          for (let i = 0; i < node.items.length; ++i) {
            const ci = await visitAsync_(i, node.items[i], visitor, path);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              node.items.splice(i, 1);
              i -= 1;
            }
          }
        } else if (identity.isPair(node)) {
          path = Object.freeze(path.concat(node));
          const ck = await visitAsync_("key", node.key, visitor, path);
          if (ck === BREAK)
            return BREAK;
          else if (ck === REMOVE)
            node.key = null;
          const cv = await visitAsync_("value", node.value, visitor, path);
          if (cv === BREAK)
            return BREAK;
          else if (cv === REMOVE)
            node.value = null;
        }
      }
      return ctrl;
    }
    function initVisitor(visitor) {
      if (typeof visitor === "object" && (visitor.Collection || visitor.Node || visitor.Value)) {
        return Object.assign({
          Alias: visitor.Node,
          Map: visitor.Node,
          Scalar: visitor.Node,
          Seq: visitor.Node
        }, visitor.Value && {
          Map: visitor.Value,
          Scalar: visitor.Value,
          Seq: visitor.Value
        }, visitor.Collection && {
          Map: visitor.Collection,
          Seq: visitor.Collection
        }, visitor);
      }
      return visitor;
    }
    function callVisitor(key, node, visitor, path) {
      if (typeof visitor === "function")
        return visitor(key, node, path);
      if (identity.isMap(node))
        return visitor.Map?.(key, node, path);
      if (identity.isSeq(node))
        return visitor.Seq?.(key, node, path);
      if (identity.isPair(node))
        return visitor.Pair?.(key, node, path);
      if (identity.isScalar(node))
        return visitor.Scalar?.(key, node, path);
      if (identity.isAlias(node))
        return visitor.Alias?.(key, node, path);
      return void 0;
    }
    function replaceNode(key, path, node) {
      const parent = path[path.length - 1];
      if (identity.isCollection(parent)) {
        parent.items[key] = node;
      } else if (identity.isPair(parent)) {
        if (key === "key")
          parent.key = node;
        else
          parent.value = node;
      } else if (identity.isDocument(parent)) {
        parent.contents = node;
      } else {
        const pt = identity.isAlias(parent) ? "alias" : "scalar";
        throw new Error(`Cannot replace node with ${pt} parent`);
      }
    }
    exports.visit = visit;
    exports.visitAsync = visitAsync;
  }
});

// node_modules/yaml/dist/doc/directives.js
var require_directives = __commonJS({
  "node_modules/yaml/dist/doc/directives.js"(exports) {
    "use strict";
    var identity = require_identity();
    var visit = require_visit();
    var escapeChars = {
      "!": "%21",
      ",": "%2C",
      "[": "%5B",
      "]": "%5D",
      "{": "%7B",
      "}": "%7D"
    };
    var escapeTagName = (tn) => tn.replace(/[!,[\]{}]/g, (ch) => escapeChars[ch]);
    var Directives = class _Directives {
      constructor(yaml, tags) {
        this.docStart = null;
        this.docEnd = false;
        this.yaml = Object.assign({}, _Directives.defaultYaml, yaml);
        this.tags = Object.assign({}, _Directives.defaultTags, tags);
      }
      clone() {
        const copy = new _Directives(this.yaml, this.tags);
        copy.docStart = this.docStart;
        return copy;
      }
      /**
       * During parsing, get a Directives instance for the current document and
       * update the stream state according to the current version's spec.
       */
      atDocument() {
        const res = new _Directives(this.yaml, this.tags);
        switch (this.yaml.version) {
          case "1.1":
            this.atNextDocument = true;
            break;
          case "1.2":
            this.atNextDocument = false;
            this.yaml = {
              explicit: _Directives.defaultYaml.explicit,
              version: "1.2"
            };
            this.tags = Object.assign({}, _Directives.defaultTags);
            break;
        }
        return res;
      }
      /**
       * @param onError - May be called even if the action was successful
       * @returns `true` on success
       */
      add(line, onError) {
        if (this.atNextDocument) {
          this.yaml = { explicit: _Directives.defaultYaml.explicit, version: "1.1" };
          this.tags = Object.assign({}, _Directives.defaultTags);
          this.atNextDocument = false;
        }
        const parts = line.trim().split(/[ \t]+/);
        const name = parts.shift();
        switch (name) {
          case "%TAG": {
            if (parts.length !== 2) {
              onError(0, "%TAG directive should contain exactly two parts");
              if (parts.length < 2)
                return false;
            }
            const [handle, prefix] = parts;
            this.tags[handle] = prefix;
            return true;
          }
          case "%YAML": {
            this.yaml.explicit = true;
            if (parts.length !== 1) {
              onError(0, "%YAML directive should contain exactly one part");
              return false;
            }
            const [version] = parts;
            if (version === "1.1" || version === "1.2") {
              this.yaml.version = version;
              return true;
            } else {
              const isValid = /^\d+\.\d+$/.test(version);
              onError(6, `Unsupported YAML version ${version}`, isValid);
              return false;
            }
          }
          default:
            onError(0, `Unknown directive ${name}`, true);
            return false;
        }
      }
      /**
       * Resolves a tag, matching handles to those defined in %TAG directives.
       *
       * @returns Resolved tag, which may also be the non-specific tag `'!'` or a
       *   `'!local'` tag, or `null` if unresolvable.
       */
      tagName(source, onError) {
        if (source === "!")
          return "!";
        if (source[0] !== "!") {
          onError(`Not a valid tag: ${source}`);
          return null;
        }
        if (source[1] === "<") {
          const verbatim = source.slice(2, -1);
          if (verbatim === "!" || verbatim === "!!") {
            onError(`Verbatim tags aren't resolved, so ${source} is invalid.`);
            return null;
          }
          if (source[source.length - 1] !== ">")
            onError("Verbatim tags must end with a >");
          return verbatim;
        }
        const [, handle, suffix] = source.match(/^(.*!)([^!]*)$/s);
        if (!suffix)
          onError(`The ${source} tag has no suffix`);
        const prefix = this.tags[handle];
        if (prefix) {
          try {
            return prefix + decodeURIComponent(suffix);
          } catch (error) {
            onError(String(error));
            return null;
          }
        }
        if (handle === "!")
          return source;
        onError(`Could not resolve tag: ${source}`);
        return null;
      }
      /**
       * Given a fully resolved tag, returns its printable string form,
       * taking into account current tag prefixes and defaults.
       */
      tagString(tag) {
        for (const [handle, prefix] of Object.entries(this.tags)) {
          if (tag.startsWith(prefix))
            return handle + escapeTagName(tag.substring(prefix.length));
        }
        return tag[0] === "!" ? tag : `!<${tag}>`;
      }
      toString(doc) {
        const lines = this.yaml.explicit ? [`%YAML ${this.yaml.version || "1.2"}`] : [];
        const tagEntries = Object.entries(this.tags);
        let tagNames;
        if (doc && tagEntries.length > 0 && identity.isNode(doc.contents)) {
          const tags = {};
          visit.visit(doc.contents, (_key, node) => {
            if (identity.isNode(node) && node.tag)
              tags[node.tag] = true;
          });
          tagNames = Object.keys(tags);
        } else
          tagNames = [];
        for (const [handle, prefix] of tagEntries) {
          if (handle === "!!" && prefix === "tag:yaml.org,2002:")
            continue;
          if (!doc || tagNames.some((tn) => tn.startsWith(prefix)))
            lines.push(`%TAG ${handle} ${prefix}`);
        }
        return lines.join("\n");
      }
    };
    Directives.defaultYaml = { explicit: false, version: "1.2" };
    Directives.defaultTags = { "!!": "tag:yaml.org,2002:" };
    exports.Directives = Directives;
  }
});

// node_modules/yaml/dist/doc/anchors.js
var require_anchors = __commonJS({
  "node_modules/yaml/dist/doc/anchors.js"(exports) {
    "use strict";
    var identity = require_identity();
    var visit = require_visit();
    function anchorIsValid(anchor) {
      if (/[\x00-\x19\s,[\]{}]/.test(anchor)) {
        const sa = JSON.stringify(anchor);
        const msg = `Anchor must not contain whitespace or control characters: ${sa}`;
        throw new Error(msg);
      }
      return true;
    }
    function anchorNames(root) {
      const anchors = /* @__PURE__ */ new Set();
      visit.visit(root, {
        Value(_key, node) {
          if (node.anchor)
            anchors.add(node.anchor);
        }
      });
      return anchors;
    }
    function findNewAnchor(prefix, exclude) {
      for (let i = 1; true; ++i) {
        const name = `${prefix}${i}`;
        if (!exclude.has(name))
          return name;
      }
    }
    function createNodeAnchors(doc, prefix) {
      const aliasObjects = [];
      const sourceObjects = /* @__PURE__ */ new Map();
      let prevAnchors = null;
      return {
        onAnchor: (source) => {
          aliasObjects.push(source);
          prevAnchors ?? (prevAnchors = anchorNames(doc));
          const anchor = findNewAnchor(prefix, prevAnchors);
          prevAnchors.add(anchor);
          return anchor;
        },
        /**
         * With circular references, the source node is only resolved after all
         * of its child nodes are. This is why anchors are set only after all of
         * the nodes have been created.
         */
        setAnchors: () => {
          for (const source of aliasObjects) {
            const ref = sourceObjects.get(source);
            if (typeof ref === "object" && ref.anchor && (identity.isScalar(ref.node) || identity.isCollection(ref.node))) {
              ref.node.anchor = ref.anchor;
            } else {
              const error = new Error("Failed to resolve repeated object (this should not happen)");
              error.source = source;
              throw error;
            }
          }
        },
        sourceObjects
      };
    }
    exports.anchorIsValid = anchorIsValid;
    exports.anchorNames = anchorNames;
    exports.createNodeAnchors = createNodeAnchors;
    exports.findNewAnchor = findNewAnchor;
  }
});

// node_modules/yaml/dist/doc/applyReviver.js
var require_applyReviver = __commonJS({
  "node_modules/yaml/dist/doc/applyReviver.js"(exports) {
    "use strict";
    function applyReviver(reviver, obj, key, val) {
      if (val && typeof val === "object") {
        if (Array.isArray(val)) {
          for (let i = 0, len = val.length; i < len; ++i) {
            const v0 = val[i];
            const v1 = applyReviver(reviver, val, String(i), v0);
            if (v1 === void 0)
              delete val[i];
            else if (v1 !== v0)
              val[i] = v1;
          }
        } else if (val instanceof Map) {
          for (const k of Array.from(val.keys())) {
            const v0 = val.get(k);
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0)
              val.delete(k);
            else if (v1 !== v0)
              val.set(k, v1);
          }
        } else if (val instanceof Set) {
          for (const v0 of Array.from(val)) {
            const v1 = applyReviver(reviver, val, v0, v0);
            if (v1 === void 0)
              val.delete(v0);
            else if (v1 !== v0) {
              val.delete(v0);
              val.add(v1);
            }
          }
        } else {
          for (const [k, v0] of Object.entries(val)) {
            const v1 = applyReviver(reviver, val, k, v0);
            if (v1 === void 0)
              delete val[k];
            else if (v1 !== v0)
              val[k] = v1;
          }
        }
      }
      return reviver.call(obj, key, val);
    }
    exports.applyReviver = applyReviver;
  }
});

// node_modules/yaml/dist/nodes/toJS.js
var require_toJS = __commonJS({
  "node_modules/yaml/dist/nodes/toJS.js"(exports) {
    "use strict";
    var identity = require_identity();
    function toJS(value, arg, ctx) {
      if (Array.isArray(value))
        return value.map((v, i) => toJS(v, String(i), ctx));
      if (value && typeof value.toJSON === "function") {
        if (!ctx || !identity.hasAnchor(value))
          return value.toJSON(arg, ctx);
        const data = { aliasCount: 0, count: 1, res: void 0 };
        ctx.anchors.set(value, data);
        ctx.onCreate = (res2) => {
          data.res = res2;
          delete ctx.onCreate;
        };
        const res = value.toJSON(arg, ctx);
        if (ctx.onCreate)
          ctx.onCreate(res);
        return res;
      }
      if (typeof value === "bigint" && !ctx?.keep)
        return Number(value);
      return value;
    }
    exports.toJS = toJS;
  }
});

// node_modules/yaml/dist/nodes/Node.js
var require_Node = __commonJS({
  "node_modules/yaml/dist/nodes/Node.js"(exports) {
    "use strict";
    var applyReviver = require_applyReviver();
    var identity = require_identity();
    var toJS = require_toJS();
    var NodeBase = class {
      constructor(type) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: type });
      }
      /** Create a copy of this node.  */
      clone() {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** A plain JavaScript representation of this node. */
      toJS(doc, { mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        if (!identity.isDocument(doc))
          throw new TypeError("A document argument is required");
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc,
          keep: true,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this, "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
    };
    exports.NodeBase = NodeBase;
  }
});

// node_modules/yaml/dist/nodes/Alias.js
var require_Alias = __commonJS({
  "node_modules/yaml/dist/nodes/Alias.js"(exports) {
    "use strict";
    var anchors = require_anchors();
    var visit = require_visit();
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var Alias = class extends Node.NodeBase {
      constructor(source) {
        super(identity.ALIAS);
        this.source = source;
        Object.defineProperty(this, "tag", {
          set() {
            throw new Error("Alias nodes cannot have tags");
          }
        });
      }
      /**
       * Resolve the value of this alias within `doc`, finding the last
       * instance of the `source` anchor before this node.
       */
      resolve(doc, ctx) {
        if (ctx?.maxAliasCount === 0)
          throw new ReferenceError("Alias resolution is disabled");
        let nodes;
        if (ctx?.aliasResolveCache) {
          nodes = ctx.aliasResolveCache;
        } else {
          nodes = [];
          visit.visit(doc, {
            Node: (_key, node) => {
              if (identity.isAlias(node) || identity.hasAnchor(node))
                nodes.push(node);
            }
          });
          if (ctx)
            ctx.aliasResolveCache = nodes;
        }
        let found = void 0;
        for (const node of nodes) {
          if (node === this)
            break;
          if (node.anchor === this.source)
            found = node;
        }
        return found;
      }
      toJSON(_arg, ctx) {
        if (!ctx)
          return { source: this.source };
        const { anchors: anchors2, doc, maxAliasCount } = ctx;
        const source = this.resolve(doc, ctx);
        if (!source) {
          const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
          throw new ReferenceError(msg);
        }
        let data = anchors2.get(source);
        if (!data) {
          toJS.toJS(source, null, ctx);
          data = anchors2.get(source);
        }
        if (data?.res === void 0) {
          const msg = "This should not happen: Alias anchor was not resolved?";
          throw new ReferenceError(msg);
        }
        if (maxAliasCount >= 0) {
          data.count += 1;
          if (data.aliasCount === 0)
            data.aliasCount = getAliasCount(doc, source, anchors2);
          if (data.count * data.aliasCount > maxAliasCount) {
            const msg = "Excessive alias count indicates a resource exhaustion attack";
            throw new ReferenceError(msg);
          }
        }
        return data.res;
      }
      toString(ctx, _onComment, _onChompKeep) {
        const src = `*${this.source}`;
        if (ctx) {
          anchors.anchorIsValid(this.source);
          if (ctx.options.verifyAliasOrder && !ctx.anchors.has(this.source)) {
            const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
            throw new Error(msg);
          }
          if (ctx.implicitKey)
            return `${src} `;
        }
        return src;
      }
    };
    function getAliasCount(doc, node, anchors2) {
      if (identity.isAlias(node)) {
        const source = node.resolve(doc);
        const anchor = anchors2 && source && anchors2.get(source);
        return anchor ? anchor.count * anchor.aliasCount : 0;
      } else if (identity.isCollection(node)) {
        let count = 0;
        for (const item of node.items) {
          const c = getAliasCount(doc, item, anchors2);
          if (c > count)
            count = c;
        }
        return count;
      } else if (identity.isPair(node)) {
        const kc = getAliasCount(doc, node.key, anchors2);
        const vc = getAliasCount(doc, node.value, anchors2);
        return Math.max(kc, vc);
      }
      return 1;
    }
    exports.Alias = Alias;
  }
});

// node_modules/yaml/dist/nodes/Scalar.js
var require_Scalar = __commonJS({
  "node_modules/yaml/dist/nodes/Scalar.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Node = require_Node();
    var toJS = require_toJS();
    var isScalarValue = (value) => !value || typeof value !== "function" && typeof value !== "object";
    var Scalar2 = class extends Node.NodeBase {
      constructor(value) {
        super(identity.SCALAR);
        this.value = value;
      }
      toJSON(arg, ctx) {
        return ctx?.keep ? this.value : toJS.toJS(this.value, arg, ctx);
      }
      toString() {
        return String(this.value);
      }
    };
    Scalar2.BLOCK_FOLDED = "BLOCK_FOLDED";
    Scalar2.BLOCK_LITERAL = "BLOCK_LITERAL";
    Scalar2.PLAIN = "PLAIN";
    Scalar2.QUOTE_DOUBLE = "QUOTE_DOUBLE";
    Scalar2.QUOTE_SINGLE = "QUOTE_SINGLE";
    exports.Scalar = Scalar2;
    exports.isScalarValue = isScalarValue;
  }
});

// node_modules/yaml/dist/doc/createNode.js
var require_createNode = __commonJS({
  "node_modules/yaml/dist/doc/createNode.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var identity = require_identity();
    var Scalar2 = require_Scalar();
    var defaultTagPrefix = "tag:yaml.org,2002:";
    function findTagObject(value, tagName, tags) {
      if (tagName) {
        const match = tags.filter((t) => t.tag === tagName);
        const tagObj = match.find((t) => !t.format) ?? match[0];
        if (!tagObj)
          throw new Error(`Tag ${tagName} not found`);
        return tagObj;
      }
      return tags.find((t) => t.identify?.(value) && !t.format);
    }
    function createNode(value, tagName, ctx) {
      if (identity.isDocument(value))
        value = value.contents;
      if (identity.isNode(value))
        return value;
      if (identity.isPair(value)) {
        const map = ctx.schema[identity.MAP].createNode?.(ctx.schema, null, ctx);
        map.items.push(value);
        return map;
      }
      if (value instanceof String || value instanceof Number || value instanceof Boolean || typeof BigInt !== "undefined" && value instanceof BigInt) {
        value = value.valueOf();
      }
      const { aliasDuplicateObjects, onAnchor, onTagObj, schema, sourceObjects } = ctx;
      let ref = void 0;
      if (aliasDuplicateObjects && value && typeof value === "object") {
        ref = sourceObjects.get(value);
        if (ref) {
          ref.anchor ?? (ref.anchor = onAnchor(value));
          return new Alias.Alias(ref.anchor);
        } else {
          ref = { anchor: null, node: null };
          sourceObjects.set(value, ref);
        }
      }
      if (tagName?.startsWith("!!"))
        tagName = defaultTagPrefix + tagName.slice(2);
      let tagObj = findTagObject(value, tagName, schema.tags);
      if (!tagObj) {
        if (value && typeof value.toJSON === "function") {
          value = value.toJSON();
        }
        if (!value || typeof value !== "object") {
          const node2 = new Scalar2.Scalar(value);
          if (ref)
            ref.node = node2;
          return node2;
        }
        tagObj = value instanceof Map ? schema[identity.MAP] : Symbol.iterator in Object(value) ? schema[identity.SEQ] : schema[identity.MAP];
      }
      if (onTagObj) {
        onTagObj(tagObj);
        delete ctx.onTagObj;
      }
      const node = tagObj?.createNode ? tagObj.createNode(ctx.schema, value, ctx) : typeof tagObj?.nodeClass?.from === "function" ? tagObj.nodeClass.from(ctx.schema, value, ctx) : new Scalar2.Scalar(value);
      if (tagName)
        node.tag = tagName;
      else if (!tagObj.default)
        node.tag = tagObj.tag;
      if (ref)
        ref.node = node;
      return node;
    }
    exports.createNode = createNode;
  }
});

// node_modules/yaml/dist/nodes/Collection.js
var require_Collection = __commonJS({
  "node_modules/yaml/dist/nodes/Collection.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var identity = require_identity();
    var Node = require_Node();
    function collectionFromPath(schema, path, value) {
      let v = value;
      for (let i = path.length - 1; i >= 0; --i) {
        const k = path[i];
        if (typeof k === "number" && Number.isInteger(k) && k >= 0) {
          const a = [];
          a[k] = v;
          v = a;
        } else {
          v = /* @__PURE__ */ new Map([[k, v]]);
        }
      }
      return createNode.createNode(v, void 0, {
        aliasDuplicateObjects: false,
        keepUndefined: false,
        onAnchor: () => {
          throw new Error("This should not happen, please report a bug.");
        },
        schema,
        sourceObjects: /* @__PURE__ */ new Map()
      });
    }
    var isEmptyPath = (path) => path == null || typeof path === "object" && !!path[Symbol.iterator]().next().done;
    var Collection = class extends Node.NodeBase {
      constructor(type, schema) {
        super(type);
        Object.defineProperty(this, "schema", {
          value: schema,
          configurable: true,
          enumerable: false,
          writable: true
        });
      }
      /**
       * Create a copy of this collection.
       *
       * @param schema - If defined, overwrites the original's schema
       */
      clone(schema) {
        const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
        if (schema)
          copy.schema = schema;
        copy.items = copy.items.map((it) => identity.isNode(it) || identity.isPair(it) ? it.clone(schema) : it);
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /**
       * Adds a value to the collection. For `!!map` and `!!omap` the value must
       * be a Pair instance or a `{ key, value }` object, which may not have a key
       * that already exists in the map.
       */
      addIn(path, value) {
        if (isEmptyPath(path))
          this.add(value);
        else {
          const [key, ...rest] = path;
          const node = this.get(key, true);
          if (identity.isCollection(node))
            node.addIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
      /**
       * Removes a value from the collection.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path) {
        const [key, ...rest] = path;
        if (rest.length === 0)
          return this.delete(key);
        const node = this.get(key, true);
        if (identity.isCollection(node))
          return node.deleteIn(rest);
        else
          throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path, keepScalar) {
        const [key, ...rest] = path;
        const node = this.get(key, true);
        if (rest.length === 0)
          return !keepScalar && identity.isScalar(node) ? node.value : node;
        else
          return identity.isCollection(node) ? node.getIn(rest, keepScalar) : void 0;
      }
      hasAllNullValues(allowScalar) {
        return this.items.every((node) => {
          if (!identity.isPair(node))
            return false;
          const n = node.value;
          return n == null || allowScalar && identity.isScalar(n) && n.value == null && !n.commentBefore && !n.comment && !n.tag;
        });
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       */
      hasIn(path) {
        const [key, ...rest] = path;
        if (rest.length === 0)
          return this.has(key);
        const node = this.get(key, true);
        return identity.isCollection(node) ? node.hasIn(rest) : false;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path, value) {
        const [key, ...rest] = path;
        if (rest.length === 0) {
          this.set(key, value);
        } else {
          const node = this.get(key, true);
          if (identity.isCollection(node))
            node.setIn(rest, value);
          else if (node === void 0 && this.schema)
            this.set(key, collectionFromPath(this.schema, rest, value));
          else
            throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
        }
      }
    };
    exports.Collection = Collection;
    exports.collectionFromPath = collectionFromPath;
    exports.isEmptyPath = isEmptyPath;
  }
});

// node_modules/yaml/dist/stringify/stringifyComment.js
var require_stringifyComment = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyComment.js"(exports) {
    "use strict";
    var stringifyComment = (str) => str.replace(/^(?!$)(?: $)?/gm, "#");
    function indentComment(comment, indent) {
      if (/^\n+$/.test(comment))
        return comment.substring(1);
      return indent ? comment.replace(/^(?! *$)/gm, indent) : comment;
    }
    var lineComment = (str, indent, comment) => str.endsWith("\n") ? indentComment(comment, indent) : comment.includes("\n") ? "\n" + indentComment(comment, indent) : (str.endsWith(" ") ? "" : " ") + comment;
    exports.indentComment = indentComment;
    exports.lineComment = lineComment;
    exports.stringifyComment = stringifyComment;
  }
});

// node_modules/yaml/dist/stringify/foldFlowLines.js
var require_foldFlowLines = __commonJS({
  "node_modules/yaml/dist/stringify/foldFlowLines.js"(exports) {
    "use strict";
    var FOLD_FLOW = "flow";
    var FOLD_BLOCK = "block";
    var FOLD_QUOTED = "quoted";
    function foldFlowLines(text, indent, mode = "flow", { indentAtStart, lineWidth = 80, minContentWidth = 20, onFold, onOverflow } = {}) {
      if (!lineWidth || lineWidth < 0)
        return text;
      if (lineWidth < minContentWidth)
        minContentWidth = 0;
      const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
      if (text.length <= endStep)
        return text;
      const folds = [];
      const escapedFolds = {};
      let end = lineWidth - indent.length;
      if (typeof indentAtStart === "number") {
        if (indentAtStart > lineWidth - Math.max(2, minContentWidth))
          folds.push(0);
        else
          end = lineWidth - indentAtStart;
      }
      let split = void 0;
      let prev = void 0;
      let overflow = false;
      let i = -1;
      let escStart = -1;
      let escEnd = -1;
      if (mode === FOLD_BLOCK) {
        i = consumeMoreIndentedLines(text, i, indent.length);
        if (i !== -1)
          end = i + endStep;
      }
      for (let ch; ch = text[i += 1]; ) {
        if (mode === FOLD_QUOTED && ch === "\\") {
          escStart = i;
          switch (text[i + 1]) {
            case "x":
              i += 3;
              break;
            case "u":
              i += 5;
              break;
            case "U":
              i += 9;
              break;
            default:
              i += 1;
          }
          escEnd = i;
        }
        if (ch === "\n") {
          if (mode === FOLD_BLOCK)
            i = consumeMoreIndentedLines(text, i, indent.length);
          end = i + indent.length + endStep;
          split = void 0;
        } else {
          if (ch === " " && prev && prev !== " " && prev !== "\n" && prev !== "	") {
            const next = text[i + 1];
            if (next && next !== " " && next !== "\n" && next !== "	")
              split = i;
          }
          if (i >= end) {
            if (split) {
              folds.push(split);
              end = split + endStep;
              split = void 0;
            } else if (mode === FOLD_QUOTED) {
              while (prev === " " || prev === "	") {
                prev = ch;
                ch = text[i += 1];
                overflow = true;
              }
              const j = i > escEnd + 1 ? i - 2 : escStart - 1;
              if (escapedFolds[j])
                return text;
              folds.push(j);
              escapedFolds[j] = true;
              end = j + endStep;
              split = void 0;
            } else {
              overflow = true;
            }
          }
        }
        prev = ch;
      }
      if (overflow && onOverflow)
        onOverflow();
      if (folds.length === 0)
        return text;
      if (onFold)
        onFold();
      let res = text.slice(0, folds[0]);
      for (let i2 = 0; i2 < folds.length; ++i2) {
        const fold = folds[i2];
        const end2 = folds[i2 + 1] || text.length;
        if (fold === 0)
          res = `
${indent}${text.slice(0, end2)}`;
        else {
          if (mode === FOLD_QUOTED && escapedFolds[fold])
            res += `${text[fold]}\\`;
          res += `
${indent}${text.slice(fold + 1, end2)}`;
        }
      }
      return res;
    }
    function consumeMoreIndentedLines(text, i, indent) {
      let end = i;
      let start = i + 1;
      let ch = text[start];
      while (ch === " " || ch === "	") {
        if (i < start + indent) {
          ch = text[++i];
        } else {
          do {
            ch = text[++i];
          } while (ch && ch !== "\n");
          end = i;
          start = i + 1;
          ch = text[start];
        }
      }
      return end;
    }
    exports.FOLD_BLOCK = FOLD_BLOCK;
    exports.FOLD_FLOW = FOLD_FLOW;
    exports.FOLD_QUOTED = FOLD_QUOTED;
    exports.foldFlowLines = foldFlowLines;
  }
});

// node_modules/yaml/dist/stringify/stringifyString.js
var require_stringifyString = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyString.js"(exports) {
    "use strict";
    var Scalar2 = require_Scalar();
    var foldFlowLines = require_foldFlowLines();
    var getFoldOptions = (ctx, isBlock) => ({
      indentAtStart: isBlock ? ctx.indent.length : ctx.indentAtStart,
      lineWidth: ctx.options.lineWidth,
      minContentWidth: ctx.options.minContentWidth
    });
    var containsDocumentMarker = (str) => /^(%|---|\.\.\.)/m.test(str);
    function lineLengthOverLimit(str, lineWidth, indentLength) {
      if (!lineWidth || lineWidth < 0)
        return false;
      const limit = lineWidth - indentLength;
      const strLen = str.length;
      if (strLen <= limit)
        return false;
      for (let i = 0, start = 0; i < strLen; ++i) {
        if (str[i] === "\n") {
          if (i - start > limit)
            return true;
          start = i + 1;
          if (strLen - start <= limit)
            return false;
        }
      }
      return true;
    }
    function doubleQuotedString(value, ctx) {
      const json = JSON.stringify(value);
      if (ctx.options.doubleQuotedAsJSON)
        return json;
      const { implicitKey } = ctx;
      const minMultiLineLength = ctx.options.doubleQuotedMinMultiLineLength;
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      let str = "";
      let start = 0;
      for (let i = 0, ch = json[i]; ch; ch = json[++i]) {
        if (ch === " " && json[i + 1] === "\\" && json[i + 2] === "n") {
          str += json.slice(start, i) + "\\ ";
          i += 1;
          start = i;
          ch = "\\";
        }
        if (ch === "\\")
          switch (json[i + 1]) {
            case "u":
              {
                str += json.slice(start, i);
                const code = json.substr(i + 2, 4);
                switch (code) {
                  case "0000":
                    str += "\\0";
                    break;
                  case "0007":
                    str += "\\a";
                    break;
                  case "000b":
                    str += "\\v";
                    break;
                  case "001b":
                    str += "\\e";
                    break;
                  case "0085":
                    str += "\\N";
                    break;
                  case "00a0":
                    str += "\\_";
                    break;
                  case "2028":
                    str += "\\L";
                    break;
                  case "2029":
                    str += "\\P";
                    break;
                  default:
                    if (code.substr(0, 2) === "00")
                      str += "\\x" + code.substr(2);
                    else
                      str += json.substr(i, 6);
                }
                i += 5;
                start = i + 1;
              }
              break;
            case "n":
              if (implicitKey || json[i + 2] === '"' || json.length < minMultiLineLength) {
                i += 1;
              } else {
                str += json.slice(start, i) + "\n\n";
                while (json[i + 2] === "\\" && json[i + 3] === "n" && json[i + 4] !== '"') {
                  str += "\n";
                  i += 2;
                }
                str += indent;
                if (json[i + 2] === " ")
                  str += "\\";
                i += 1;
                start = i + 1;
              }
              break;
            default:
              i += 1;
          }
      }
      str = start ? str + json.slice(start) : json;
      return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_QUOTED, getFoldOptions(ctx, false));
    }
    function singleQuotedString(value, ctx) {
      if (ctx.options.singleQuote === false || ctx.implicitKey && value.includes("\n") || /[ \t]\n|\n[ \t]/.test(value))
        return doubleQuotedString(value, ctx);
      const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
      const res = "'" + value.replace(/'/g, "''").replace(/\n+/g, `$&
${indent}`) + "'";
      return ctx.implicitKey ? res : foldFlowLines.foldFlowLines(res, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function quotedString(value, ctx) {
      const { singleQuote } = ctx.options;
      let qs;
      if (singleQuote === false)
        qs = doubleQuotedString;
      else {
        const hasDouble = value.includes('"');
        const hasSingle = value.includes("'");
        if (hasDouble && !hasSingle)
          qs = singleQuotedString;
        else if (hasSingle && !hasDouble)
          qs = doubleQuotedString;
        else
          qs = singleQuote ? singleQuotedString : doubleQuotedString;
      }
      return qs(value, ctx);
    }
    var blockEndNewlines;
    try {
      blockEndNewlines = new RegExp("(^|(?<!\n))\n+(?!\n|$)", "g");
    } catch {
      blockEndNewlines = /\n+(?!\n|$)/g;
    }
    function blockString({ comment, type, value }, ctx, onComment, onChompKeep) {
      const { blockQuote, commentString, lineWidth } = ctx.options;
      if (!blockQuote || /\n[\t ]+$/.test(value)) {
        return quotedString(value, ctx);
      }
      const indent = ctx.indent || (ctx.forceBlockIndent || containsDocumentMarker(value) ? "  " : "");
      const literal = blockQuote === "literal" ? true : blockQuote === "folded" || type === Scalar2.Scalar.BLOCK_FOLDED ? false : type === Scalar2.Scalar.BLOCK_LITERAL ? true : !lineLengthOverLimit(value, lineWidth, indent.length);
      if (!value)
        return literal ? "|\n" : ">\n";
      let chomp;
      let endStart;
      for (endStart = value.length; endStart > 0; --endStart) {
        const ch = value[endStart - 1];
        if (ch !== "\n" && ch !== "	" && ch !== " ")
          break;
      }
      let end = value.substring(endStart);
      const endNlPos = end.indexOf("\n");
      if (endNlPos === -1) {
        chomp = "-";
      } else if (value === end || endNlPos !== end.length - 1) {
        chomp = "+";
        if (onChompKeep)
          onChompKeep();
      } else {
        chomp = "";
      }
      if (end) {
        value = value.slice(0, -end.length);
        if (end[end.length - 1] === "\n")
          end = end.slice(0, -1);
        end = end.replace(blockEndNewlines, `$&${indent}`);
      }
      let startWithSpace = false;
      let startEnd;
      let startNlPos = -1;
      for (startEnd = 0; startEnd < value.length; ++startEnd) {
        const ch = value[startEnd];
        if (ch === " ")
          startWithSpace = true;
        else if (ch === "\n")
          startNlPos = startEnd;
        else
          break;
      }
      let start = value.substring(0, startNlPos < startEnd ? startNlPos + 1 : startEnd);
      if (start) {
        value = value.substring(start.length);
        start = start.replace(/\n+/g, `$&${indent}`);
      }
      const indentSize = indent ? "2" : "1";
      let header = (startWithSpace ? indentSize : "") + chomp;
      if (comment) {
        header += " " + commentString(comment.replace(/ ?[\r\n]+/g, " "));
        if (onComment)
          onComment();
      }
      if (!literal) {
        const foldedValue = value.replace(/\n+/g, "\n$&").replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, "$1$2").replace(/\n+/g, `$&${indent}`);
        let literalFallback = false;
        const foldOptions = getFoldOptions(ctx, true);
        if (blockQuote !== "folded" && type !== Scalar2.Scalar.BLOCK_FOLDED) {
          foldOptions.onOverflow = () => {
            literalFallback = true;
          };
        }
        const body = foldFlowLines.foldFlowLines(`${start}${foldedValue}${end}`, indent, foldFlowLines.FOLD_BLOCK, foldOptions);
        if (!literalFallback)
          return `>${header}
${indent}${body}`;
      }
      value = value.replace(/\n+/g, `$&${indent}`);
      return `|${header}
${indent}${start}${value}${end}`;
    }
    function plainString2(item, ctx, onComment, onChompKeep) {
      const { type, value } = item;
      const { actualString, implicitKey, indent, indentStep, inFlow } = ctx;
      if (implicitKey && value.includes("\n") || inFlow && /[[\]{},]/.test(value)) {
        return quotedString(value, ctx);
      }
      if (/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value)) {
        return implicitKey || inFlow || !value.includes("\n") ? quotedString(value, ctx) : blockString(item, ctx, onComment, onChompKeep);
      }
      if (!implicitKey && !inFlow && type !== Scalar2.Scalar.PLAIN && value.includes("\n")) {
        return blockString(item, ctx, onComment, onChompKeep);
      }
      if (containsDocumentMarker(value)) {
        if (indent === "") {
          ctx.forceBlockIndent = true;
          return blockString(item, ctx, onComment, onChompKeep);
        } else if (implicitKey && indent === indentStep) {
          return quotedString(value, ctx);
        }
      }
      const str = value.replace(/\n+/g, `$&
${indent}`);
      if (actualString) {
        const test = (tag) => tag.default && tag.tag !== "tag:yaml.org,2002:str" && tag.test?.test(str);
        const { compat, tags } = ctx.doc.schema;
        if (tags.some(test) || compat?.some(test))
          return quotedString(value, ctx);
      }
      return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
    }
    function stringifyString(item, ctx, onComment, onChompKeep) {
      const { implicitKey, inFlow } = ctx;
      const ss = typeof item.value === "string" ? item : Object.assign({}, item, { value: String(item.value) });
      let { type } = item;
      if (type !== Scalar2.Scalar.QUOTE_DOUBLE) {
        if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(ss.value))
          type = Scalar2.Scalar.QUOTE_DOUBLE;
      }
      const _stringify = (_type) => {
        switch (_type) {
          case Scalar2.Scalar.BLOCK_FOLDED:
          case Scalar2.Scalar.BLOCK_LITERAL:
            return implicitKey || inFlow ? quotedString(ss.value, ctx) : blockString(ss, ctx, onComment, onChompKeep);
          case Scalar2.Scalar.QUOTE_DOUBLE:
            return doubleQuotedString(ss.value, ctx);
          case Scalar2.Scalar.QUOTE_SINGLE:
            return singleQuotedString(ss.value, ctx);
          case Scalar2.Scalar.PLAIN:
            return plainString2(ss, ctx, onComment, onChompKeep);
          default:
            return null;
        }
      };
      let res = _stringify(type);
      if (res === null) {
        const { defaultKeyType, defaultStringType } = ctx.options;
        const t = implicitKey && defaultKeyType || defaultStringType;
        res = _stringify(t);
        if (res === null)
          throw new Error(`Unsupported default string type ${t}`);
      }
      return res;
    }
    exports.stringifyString = stringifyString;
  }
});

// node_modules/yaml/dist/stringify/stringify.js
var require_stringify = __commonJS({
  "node_modules/yaml/dist/stringify/stringify.js"(exports) {
    "use strict";
    var anchors = require_anchors();
    var identity = require_identity();
    var stringifyComment = require_stringifyComment();
    var stringifyString = require_stringifyString();
    function createStringifyContext(doc, options) {
      const opt = Object.assign({
        blockQuote: true,
        commentString: stringifyComment.stringifyComment,
        defaultKeyType: null,
        defaultStringType: "PLAIN",
        directives: null,
        doubleQuotedAsJSON: false,
        doubleQuotedMinMultiLineLength: 40,
        falseStr: "false",
        flowCollectionPadding: true,
        indentSeq: true,
        lineWidth: 80,
        minContentWidth: 20,
        nullStr: "null",
        simpleKeys: false,
        singleQuote: null,
        trailingComma: false,
        trueStr: "true",
        verifyAliasOrder: true
      }, doc.schema.toStringOptions, options);
      let inFlow;
      switch (opt.collectionStyle) {
        case "block":
          inFlow = false;
          break;
        case "flow":
          inFlow = true;
          break;
        default:
          inFlow = null;
      }
      return {
        anchors: /* @__PURE__ */ new Set(),
        doc,
        flowCollectionPadding: opt.flowCollectionPadding ? " " : "",
        indent: "",
        indentStep: typeof opt.indent === "number" ? " ".repeat(opt.indent) : "  ",
        inFlow,
        options: opt
      };
    }
    function getTagObject(tags, item) {
      if (item.tag) {
        const match = tags.filter((t) => t.tag === item.tag);
        if (match.length > 0)
          return match.find((t) => t.format === item.format) ?? match[0];
      }
      let tagObj = void 0;
      let obj;
      if (identity.isScalar(item)) {
        obj = item.value;
        let match = tags.filter((t) => t.identify?.(obj));
        if (match.length > 1) {
          const testMatch = match.filter((t) => t.test);
          if (testMatch.length > 0)
            match = testMatch;
        }
        tagObj = match.find((t) => t.format === item.format) ?? match.find((t) => !t.format);
      } else {
        obj = item;
        tagObj = tags.find((t) => t.nodeClass && obj instanceof t.nodeClass);
      }
      if (!tagObj) {
        const name = obj?.constructor?.name ?? (obj === null ? "null" : typeof obj);
        throw new Error(`Tag not resolved for ${name} value`);
      }
      return tagObj;
    }
    function stringifyProps(node, tagObj, { anchors: anchors$1, doc }) {
      if (!doc.directives)
        return "";
      const props = [];
      const anchor = (identity.isScalar(node) || identity.isCollection(node)) && node.anchor;
      if (anchor && anchors.anchorIsValid(anchor)) {
        anchors$1.add(anchor);
        props.push(`&${anchor}`);
      }
      const tag = node.tag ?? (tagObj.default ? null : tagObj.tag);
      if (tag)
        props.push(doc.directives.tagString(tag));
      return props.join(" ");
    }
    function stringify(item, ctx, onComment, onChompKeep) {
      if (identity.isPair(item))
        return item.toString(ctx, onComment, onChompKeep);
      if (identity.isAlias(item)) {
        if (ctx.doc.directives)
          return item.toString(ctx);
        if (ctx.resolvedAliases?.has(item)) {
          throw new TypeError(`Cannot stringify circular structure without alias nodes`);
        } else {
          if (ctx.resolvedAliases)
            ctx.resolvedAliases.add(item);
          else
            ctx.resolvedAliases = /* @__PURE__ */ new Set([item]);
          item = item.resolve(ctx.doc);
        }
      }
      let tagObj = void 0;
      const node = identity.isNode(item) ? item : ctx.doc.createNode(item, { onTagObj: (o) => tagObj = o });
      tagObj ?? (tagObj = getTagObject(ctx.doc.schema.tags, node));
      const props = stringifyProps(node, tagObj, ctx);
      if (props.length > 0)
        ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
      const str = typeof tagObj.stringify === "function" ? tagObj.stringify(node, ctx, onComment, onChompKeep) : identity.isScalar(node) ? stringifyString.stringifyString(node, ctx, onComment, onChompKeep) : node.toString(ctx, onComment, onChompKeep);
      if (!props)
        return str;
      return identity.isScalar(node) || str[0] === "{" || str[0] === "[" ? `${props} ${str}` : `${props}
${ctx.indent}${str}`;
    }
    exports.createStringifyContext = createStringifyContext;
    exports.stringify = stringify;
  }
});

// node_modules/yaml/dist/stringify/stringifyPair.js
var require_stringifyPair = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyPair.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar2 = require_Scalar();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyPair({ key, value }, ctx, onComment, onChompKeep) {
      const { allNullValues, doc, indent, indentStep, options: { commentString, indentSeq, simpleKeys } } = ctx;
      let keyComment = identity.isNode(key) && key.comment || null;
      if (simpleKeys) {
        if (keyComment) {
          throw new Error("With simple keys, key nodes cannot have comments");
        }
        if (identity.isCollection(key) || !identity.isNode(key) && typeof key === "object") {
          const msg = "With simple keys, collection cannot be used as a key value";
          throw new Error(msg);
        }
      }
      let explicitKey = !simpleKeys && (!key || keyComment && value == null && !ctx.inFlow || identity.isCollection(key) || (identity.isScalar(key) ? key.type === Scalar2.Scalar.BLOCK_FOLDED || key.type === Scalar2.Scalar.BLOCK_LITERAL : typeof key === "object"));
      ctx = Object.assign({}, ctx, {
        allNullValues: false,
        implicitKey: !explicitKey && (simpleKeys || !allNullValues),
        indent: indent + indentStep
      });
      let keyCommentDone = false;
      let chompKeep = false;
      let str = stringify.stringify(key, ctx, () => keyCommentDone = true, () => chompKeep = true);
      if (!explicitKey && !ctx.inFlow && str.length > 1024) {
        if (simpleKeys)
          throw new Error("With simple keys, single line scalar must not span more than 1024 characters");
        explicitKey = true;
      }
      if (ctx.inFlow) {
        if (allNullValues || value == null) {
          if (keyCommentDone && onComment)
            onComment();
          return str === "" ? "?" : explicitKey ? `? ${str}` : str;
        }
      } else if (allNullValues && !simpleKeys || value == null && explicitKey) {
        str = `? ${str}`;
        if (keyComment && !keyCommentDone) {
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        } else if (chompKeep && onChompKeep)
          onChompKeep();
        return str;
      }
      if (keyCommentDone)
        keyComment = null;
      if (explicitKey) {
        if (keyComment)
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
        str = `? ${str}
${indent}:`;
      } else {
        str = `${str}:`;
        if (keyComment)
          str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
      }
      let vsb, vcb, valueComment;
      if (identity.isNode(value)) {
        vsb = !!value.spaceBefore;
        vcb = value.commentBefore;
        valueComment = value.comment;
      } else {
        vsb = false;
        vcb = null;
        valueComment = null;
        if (value && typeof value === "object")
          value = doc.createNode(value);
      }
      ctx.implicitKey = false;
      if (!explicitKey && !keyComment && identity.isScalar(value))
        ctx.indentAtStart = str.length + 1;
      chompKeep = false;
      if (!indentSeq && indentStep.length >= 2 && !ctx.inFlow && !explicitKey && identity.isSeq(value) && !value.flow && !value.tag && !value.anchor) {
        ctx.indent = ctx.indent.substring(2);
      }
      let valueCommentDone = false;
      const valueStr = stringify.stringify(value, ctx, () => valueCommentDone = true, () => chompKeep = true);
      let ws = " ";
      if (keyComment || vsb || vcb) {
        ws = vsb ? "\n" : "";
        if (vcb) {
          const cs = commentString(vcb);
          ws += `
${stringifyComment.indentComment(cs, ctx.indent)}`;
        }
        if (valueStr === "" && !ctx.inFlow) {
          if (ws === "\n" && valueComment)
            ws = "\n\n";
        } else {
          ws += `
${ctx.indent}`;
        }
      } else if (!explicitKey && identity.isCollection(value)) {
        const vs0 = valueStr[0];
        const nl0 = valueStr.indexOf("\n");
        const hasNewline = nl0 !== -1;
        const flow = ctx.inFlow ?? value.flow ?? value.items.length === 0;
        if (hasNewline || !flow) {
          let hasPropsLine = false;
          if (hasNewline && (vs0 === "&" || vs0 === "!")) {
            let sp0 = valueStr.indexOf(" ");
            if (vs0 === "&" && sp0 !== -1 && sp0 < nl0 && valueStr[sp0 + 1] === "!") {
              sp0 = valueStr.indexOf(" ", sp0 + 1);
            }
            if (sp0 === -1 || nl0 < sp0)
              hasPropsLine = true;
          }
          if (!hasPropsLine)
            ws = `
${ctx.indent}`;
        }
      } else if (valueStr === "" || valueStr[0] === "\n") {
        ws = "";
      }
      str += ws + valueStr;
      if (ctx.inFlow) {
        if (valueCommentDone && onComment)
          onComment();
      } else if (valueComment && !valueCommentDone) {
        str += stringifyComment.lineComment(str, ctx.indent, commentString(valueComment));
      } else if (chompKeep && onChompKeep) {
        onChompKeep();
      }
      return str;
    }
    exports.stringifyPair = stringifyPair;
  }
});

// node_modules/yaml/dist/log.js
var require_log = __commonJS({
  "node_modules/yaml/dist/log.js"(exports) {
    "use strict";
    var node_process = __require("process");
    function debug(logLevel, ...messages) {
      if (logLevel === "debug")
        console.log(...messages);
    }
    function warn(logLevel, warning) {
      if (logLevel === "debug" || logLevel === "warn") {
        if (typeof node_process.emitWarning === "function")
          node_process.emitWarning(warning);
        else
          console.warn(warning);
      }
    }
    exports.debug = debug;
    exports.warn = warn;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/merge.js
var require_merge = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/merge.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar2 = require_Scalar();
    var MERGE_KEY = "<<";
    var merge = {
      identify: (value) => value === MERGE_KEY || typeof value === "symbol" && value.description === MERGE_KEY,
      default: "key",
      tag: "tag:yaml.org,2002:merge",
      test: /^<<$/,
      resolve: () => Object.assign(new Scalar2.Scalar(Symbol(MERGE_KEY)), {
        addToJSMap: addMergeToJSMap
      }),
      stringify: () => MERGE_KEY
    };
    var isMergeKey = (ctx, key) => (merge.identify(key) || identity.isScalar(key) && (!key.type || key.type === Scalar2.Scalar.PLAIN) && merge.identify(key.value)) && ctx?.doc.schema.tags.some((tag) => tag.tag === merge.tag && tag.default);
    function addMergeToJSMap(ctx, map, value) {
      const source = resolveAliasValue(ctx, value);
      if (identity.isSeq(source))
        for (const it of source.items)
          mergeValue(ctx, map, it);
      else if (Array.isArray(source))
        for (const it of source)
          mergeValue(ctx, map, it);
      else
        mergeValue(ctx, map, source);
    }
    function mergeValue(ctx, map, value) {
      const source = resolveAliasValue(ctx, value);
      if (!identity.isMap(source))
        throw new Error("Merge sources must be maps or map aliases");
      const srcMap = source.toJSON(null, ctx, Map);
      for (const [key, value2] of srcMap) {
        if (map instanceof Map) {
          if (!map.has(key))
            map.set(key, value2);
        } else if (map instanceof Set) {
          map.add(key);
        } else if (!Object.prototype.hasOwnProperty.call(map, key)) {
          Object.defineProperty(map, key, {
            value: value2,
            writable: true,
            enumerable: true,
            configurable: true
          });
        }
      }
      return map;
    }
    function resolveAliasValue(ctx, value) {
      return ctx && identity.isAlias(value) ? value.resolve(ctx.doc, ctx) : value;
    }
    exports.addMergeToJSMap = addMergeToJSMap;
    exports.isMergeKey = isMergeKey;
    exports.merge = merge;
  }
});

// node_modules/yaml/dist/nodes/addPairToJSMap.js
var require_addPairToJSMap = __commonJS({
  "node_modules/yaml/dist/nodes/addPairToJSMap.js"(exports) {
    "use strict";
    var log = require_log();
    var merge = require_merge();
    var stringify = require_stringify();
    var identity = require_identity();
    var toJS = require_toJS();
    function addPairToJSMap(ctx, map, { key, value }) {
      if (identity.isNode(key) && key.addToJSMap)
        key.addToJSMap(ctx, map, value);
      else if (merge.isMergeKey(ctx, key))
        merge.addMergeToJSMap(ctx, map, value);
      else {
        const jsKey = toJS.toJS(key, "", ctx);
        if (map instanceof Map) {
          map.set(jsKey, toJS.toJS(value, jsKey, ctx));
        } else if (map instanceof Set) {
          map.add(jsKey);
        } else {
          const stringKey = stringifyKey(key, jsKey, ctx);
          const jsValue = toJS.toJS(value, stringKey, ctx);
          if (stringKey in map)
            Object.defineProperty(map, stringKey, {
              value: jsValue,
              writable: true,
              enumerable: true,
              configurable: true
            });
          else
            map[stringKey] = jsValue;
        }
      }
      return map;
    }
    function stringifyKey(key, jsKey, ctx) {
      if (jsKey === null)
        return "";
      if (typeof jsKey !== "object")
        return String(jsKey);
      if (identity.isNode(key) && ctx?.doc) {
        const strCtx = stringify.createStringifyContext(ctx.doc, {});
        strCtx.anchors = /* @__PURE__ */ new Set();
        for (const node of ctx.anchors.keys())
          strCtx.anchors.add(node.anchor);
        strCtx.inFlow = true;
        strCtx.inStringifyKey = true;
        const strKey = key.toString(strCtx);
        if (!ctx.mapKeyWarned) {
          let jsonStr = JSON.stringify(strKey);
          if (jsonStr.length > 40)
            jsonStr = jsonStr.substring(0, 36) + '..."';
          log.warn(ctx.doc.options.logLevel, `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`);
          ctx.mapKeyWarned = true;
        }
        return strKey;
      }
      return JSON.stringify(jsKey);
    }
    exports.addPairToJSMap = addPairToJSMap;
  }
});

// node_modules/yaml/dist/nodes/Pair.js
var require_Pair = __commonJS({
  "node_modules/yaml/dist/nodes/Pair.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var stringifyPair = require_stringifyPair();
    var addPairToJSMap = require_addPairToJSMap();
    var identity = require_identity();
    function createPair(key, value, ctx) {
      const k = createNode.createNode(key, void 0, ctx);
      const v = createNode.createNode(value, void 0, ctx);
      return new Pair(k, v);
    }
    var Pair = class _Pair {
      constructor(key, value = null) {
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.PAIR });
        this.key = key;
        this.value = value;
      }
      clone(schema) {
        let { key, value } = this;
        if (identity.isNode(key))
          key = key.clone(schema);
        if (identity.isNode(value))
          value = value.clone(schema);
        return new _Pair(key, value);
      }
      toJSON(_, ctx) {
        const pair = ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        return addPairToJSMap.addPairToJSMap(ctx, pair, this);
      }
      toString(ctx, onComment, onChompKeep) {
        return ctx?.doc ? stringifyPair.stringifyPair(this, ctx, onComment, onChompKeep) : JSON.stringify(this);
      }
    };
    exports.Pair = Pair;
    exports.createPair = createPair;
  }
});

// node_modules/yaml/dist/stringify/stringifyCollection.js
var require_stringifyCollection = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyCollection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyCollection(collection, ctx, options) {
      const flow = ctx.inFlow ?? collection.flow;
      const stringify2 = flow ? stringifyFlowCollection : stringifyBlockCollection;
      return stringify2(collection, ctx, options);
    }
    function stringifyBlockCollection({ comment, items: items2 }, ctx, { blockItemPrefix, flowChars, itemIndent, onChompKeep, onComment }) {
      const { indent, options: { commentString } } = ctx;
      const itemCtx = Object.assign({}, ctx, { indent: itemIndent, type: null });
      let chompKeep = false;
      const lines = [];
      for (let i = 0; i < items2.length; ++i) {
        const item = items2[i];
        let comment2 = null;
        if (identity.isNode(item)) {
          if (!chompKeep && item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, chompKeep);
          if (item.comment)
            comment2 = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (!chompKeep && ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, chompKeep);
          }
        }
        chompKeep = false;
        let str2 = stringify.stringify(item, itemCtx, () => comment2 = null, () => chompKeep = true);
        if (comment2)
          str2 += stringifyComment.lineComment(str2, itemIndent, commentString(comment2));
        if (chompKeep && comment2)
          chompKeep = false;
        lines.push(blockItemPrefix + str2);
      }
      let str;
      if (lines.length === 0) {
        str = flowChars.start + flowChars.end;
      } else {
        str = lines[0];
        for (let i = 1; i < lines.length; ++i) {
          const line = lines[i];
          str += line ? `
${indent}${line}` : "\n";
        }
      }
      if (comment) {
        str += "\n" + stringifyComment.indentComment(commentString(comment), indent);
        if (onComment)
          onComment();
      } else if (chompKeep && onChompKeep)
        onChompKeep();
      return str;
    }
    function stringifyFlowCollection({ items: items2 }, ctx, { flowChars, itemIndent }) {
      const { indent, indentStep, flowCollectionPadding: fcPadding, options: { commentString } } = ctx;
      itemIndent += indentStep;
      const itemCtx = Object.assign({}, ctx, {
        indent: itemIndent,
        inFlow: true,
        type: null
      });
      let reqNewline = false;
      let linesAtValue = 0;
      const lines = [];
      for (let i = 0; i < items2.length; ++i) {
        const item = items2[i];
        let comment = null;
        if (identity.isNode(item)) {
          if (item.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, item.commentBefore, false);
          if (item.comment)
            comment = item.comment;
        } else if (identity.isPair(item)) {
          const ik = identity.isNode(item.key) ? item.key : null;
          if (ik) {
            if (ik.spaceBefore)
              lines.push("");
            addCommentBefore(ctx, lines, ik.commentBefore, false);
            if (ik.comment)
              reqNewline = true;
          }
          const iv = identity.isNode(item.value) ? item.value : null;
          if (iv) {
            if (iv.comment)
              comment = iv.comment;
            if (iv.commentBefore)
              reqNewline = true;
          } else if (item.value == null && ik?.comment) {
            comment = ik.comment;
          }
        }
        if (comment)
          reqNewline = true;
        let str = stringify.stringify(item, itemCtx, () => comment = null);
        reqNewline || (reqNewline = lines.length > linesAtValue || str.includes("\n"));
        if (i < items2.length - 1) {
          str += ",";
        } else if (ctx.options.trailingComma) {
          if (ctx.options.lineWidth > 0) {
            reqNewline || (reqNewline = lines.reduce((sum, line) => sum + line.length + 2, 2) + (str.length + 2) > ctx.options.lineWidth);
          }
          if (reqNewline) {
            str += ",";
          }
        }
        if (comment)
          str += stringifyComment.lineComment(str, itemIndent, commentString(comment));
        lines.push(str);
        linesAtValue = lines.length;
      }
      const { start, end } = flowChars;
      if (lines.length === 0) {
        return start + end;
      } else {
        if (!reqNewline) {
          const len = lines.reduce((sum, line) => sum + line.length + 2, 2);
          reqNewline = ctx.options.lineWidth > 0 && len > ctx.options.lineWidth;
        }
        if (reqNewline) {
          let str = start;
          for (const line of lines)
            str += line ? `
${indentStep}${indent}${line}` : "\n";
          return `${str}
${indent}${end}`;
        } else {
          return `${start}${fcPadding}${lines.join(" ")}${fcPadding}${end}`;
        }
      }
    }
    function addCommentBefore({ indent, options: { commentString } }, lines, comment, chompKeep) {
      if (comment && chompKeep)
        comment = comment.replace(/^\n+/, "");
      if (comment) {
        const ic = stringifyComment.indentComment(commentString(comment), indent);
        lines.push(ic.trimStart());
      }
    }
    exports.stringifyCollection = stringifyCollection;
  }
});

// node_modules/yaml/dist/nodes/YAMLMap.js
var require_YAMLMap = __commonJS({
  "node_modules/yaml/dist/nodes/YAMLMap.js"(exports) {
    "use strict";
    var stringifyCollection = require_stringifyCollection();
    var addPairToJSMap = require_addPairToJSMap();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar2 = require_Scalar();
    function findPair(items2, key) {
      const k = identity.isScalar(key) ? key.value : key;
      for (const it of items2) {
        if (identity.isPair(it)) {
          if (it.key === key || it.key === k)
            return it;
          if (identity.isScalar(it.key) && it.key.value === k)
            return it;
        }
      }
      return void 0;
    }
    var YAMLMap = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:map";
      }
      constructor(schema) {
        super(identity.MAP, schema);
        this.items = [];
      }
      /**
       * A generic collection parsing method that can be extended
       * to other node classes that inherit from YAMLMap
       */
      static from(schema, obj, ctx) {
        const { keepUndefined, replacer } = ctx;
        const map = new this(schema);
        const add = (key, value) => {
          if (typeof replacer === "function")
            value = replacer.call(obj, key, value);
          else if (Array.isArray(replacer) && !replacer.includes(key))
            return;
          if (value !== void 0 || keepUndefined)
            map.items.push(Pair.createPair(key, value, ctx));
        };
        if (obj instanceof Map) {
          for (const [key, value] of obj)
            add(key, value);
        } else if (obj && typeof obj === "object") {
          for (const key of Object.keys(obj))
            add(key, obj[key]);
        }
        if (typeof schema.sortMapEntries === "function") {
          map.items.sort(schema.sortMapEntries);
        }
        return map;
      }
      /**
       * Adds a value to the collection.
       *
       * @param overwrite - If not set `true`, using a key that is already in the
       *   collection will throw. Otherwise, overwrites the previous value.
       */
      add(pair, overwrite) {
        let _pair;
        if (identity.isPair(pair))
          _pair = pair;
        else if (!pair || typeof pair !== "object" || !("key" in pair)) {
          _pair = new Pair.Pair(pair, pair?.value);
        } else
          _pair = new Pair.Pair(pair.key, pair.value);
        const prev = findPair(this.items, _pair.key);
        const sortEntries = this.schema?.sortMapEntries;
        if (prev) {
          if (!overwrite)
            throw new Error(`Key ${_pair.key} already set`);
          if (identity.isScalar(prev.value) && Scalar2.isScalarValue(_pair.value))
            prev.value.value = _pair.value;
          else
            prev.value = _pair.value;
        } else if (sortEntries) {
          const i = this.items.findIndex((item) => sortEntries(_pair, item) < 0);
          if (i === -1)
            this.items.push(_pair);
          else
            this.items.splice(i, 0, _pair);
        } else {
          this.items.push(_pair);
        }
      }
      delete(key) {
        const it = findPair(this.items, key);
        if (!it)
          return false;
        const del = this.items.splice(this.items.indexOf(it), 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const it = findPair(this.items, key);
        const node = it?.value;
        return (!keepScalar && identity.isScalar(node) ? node.value : node) ?? void 0;
      }
      has(key) {
        return !!findPair(this.items, key);
      }
      set(key, value) {
        this.add(new Pair.Pair(key, value), true);
      }
      /**
       * @param ctx - Conversion context, originally set in Document#toJS()
       * @param {Class} Type - If set, forces the returned collection type
       * @returns Instance of Type, Map, or Object
       */
      toJSON(_, ctx, Type) {
        const map = Type ? new Type() : ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const item of this.items)
          addPairToJSMap.addPairToJSMap(ctx, map, item);
        return map;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        for (const item of this.items) {
          if (!identity.isPair(item))
            throw new Error(`Map items must all be pairs; found ${JSON.stringify(item)} instead`);
        }
        if (!ctx.allNullValues && this.hasAllNullValues(false))
          ctx = Object.assign({}, ctx, { allNullValues: true });
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "",
          flowChars: { start: "{", end: "}" },
          itemIndent: ctx.indent || "",
          onChompKeep,
          onComment
        });
      }
    };
    exports.YAMLMap = YAMLMap;
    exports.findPair = findPair;
  }
});

// node_modules/yaml/dist/schema/common/map.js
var require_map = __commonJS({
  "node_modules/yaml/dist/schema/common/map.js"(exports) {
    "use strict";
    var identity = require_identity();
    var YAMLMap = require_YAMLMap();
    var map = {
      collection: "map",
      default: true,
      nodeClass: YAMLMap.YAMLMap,
      tag: "tag:yaml.org,2002:map",
      resolve(map2, onError) {
        if (!identity.isMap(map2))
          onError("Expected a mapping for this tag");
        return map2;
      },
      createNode: (schema, obj, ctx) => YAMLMap.YAMLMap.from(schema, obj, ctx)
    };
    exports.map = map;
  }
});

// node_modules/yaml/dist/nodes/YAMLSeq.js
var require_YAMLSeq = __commonJS({
  "node_modules/yaml/dist/nodes/YAMLSeq.js"(exports) {
    "use strict";
    var createNode = require_createNode();
    var stringifyCollection = require_stringifyCollection();
    var Collection = require_Collection();
    var identity = require_identity();
    var Scalar2 = require_Scalar();
    var toJS = require_toJS();
    var YAMLSeq = class extends Collection.Collection {
      static get tagName() {
        return "tag:yaml.org,2002:seq";
      }
      constructor(schema) {
        super(identity.SEQ, schema);
        this.items = [];
      }
      add(value) {
        this.items.push(value);
      }
      /**
       * Removes a value from the collection.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       *
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return false;
        const del = this.items.splice(idx, 1);
        return del.length > 0;
      }
      get(key, keepScalar) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          return void 0;
        const it = this.items[idx];
        return !keepScalar && identity.isScalar(it) ? it.value : it;
      }
      /**
       * Checks if the collection includes a value with the key `key`.
       *
       * `key` must contain a representation of an integer for this to succeed.
       * It may be wrapped in a `Scalar`.
       */
      has(key) {
        const idx = asItemIndex(key);
        return typeof idx === "number" && idx < this.items.length;
      }
      /**
       * Sets a value in this collection. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       *
       * If `key` does not contain a representation of an integer, this will throw.
       * It may be wrapped in a `Scalar`.
       */
      set(key, value) {
        const idx = asItemIndex(key);
        if (typeof idx !== "number")
          throw new Error(`Expected a valid index, not ${key}.`);
        const prev = this.items[idx];
        if (identity.isScalar(prev) && Scalar2.isScalarValue(value))
          prev.value = value;
        else
          this.items[idx] = value;
      }
      toJSON(_, ctx) {
        const seq = [];
        if (ctx?.onCreate)
          ctx.onCreate(seq);
        let i = 0;
        for (const item of this.items)
          seq.push(toJS.toJS(item, String(i++), ctx));
        return seq;
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        return stringifyCollection.stringifyCollection(this, ctx, {
          blockItemPrefix: "- ",
          flowChars: { start: "[", end: "]" },
          itemIndent: (ctx.indent || "") + "  ",
          onChompKeep,
          onComment
        });
      }
      static from(schema, obj, ctx) {
        const { replacer } = ctx;
        const seq = new this(schema);
        if (obj && Symbol.iterator in Object(obj)) {
          let i = 0;
          for (let it of obj) {
            if (typeof replacer === "function") {
              const key = obj instanceof Set ? it : String(i++);
              it = replacer.call(obj, key, it);
            }
            seq.items.push(createNode.createNode(it, void 0, ctx));
          }
        }
        return seq;
      }
    };
    function asItemIndex(key) {
      let idx = identity.isScalar(key) ? key.value : key;
      if (idx && typeof idx === "string")
        idx = Number(idx);
      return typeof idx === "number" && Number.isInteger(idx) && idx >= 0 ? idx : null;
    }
    exports.YAMLSeq = YAMLSeq;
  }
});

// node_modules/yaml/dist/schema/common/seq.js
var require_seq = __commonJS({
  "node_modules/yaml/dist/schema/common/seq.js"(exports) {
    "use strict";
    var identity = require_identity();
    var YAMLSeq = require_YAMLSeq();
    var seq = {
      collection: "seq",
      default: true,
      nodeClass: YAMLSeq.YAMLSeq,
      tag: "tag:yaml.org,2002:seq",
      resolve(seq2, onError) {
        if (!identity.isSeq(seq2))
          onError("Expected a sequence for this tag");
        return seq2;
      },
      createNode: (schema, obj, ctx) => YAMLSeq.YAMLSeq.from(schema, obj, ctx)
    };
    exports.seq = seq;
  }
});

// node_modules/yaml/dist/schema/common/string.js
var require_string = __commonJS({
  "node_modules/yaml/dist/schema/common/string.js"(exports) {
    "use strict";
    var stringifyString = require_stringifyString();
    var string = {
      identify: (value) => typeof value === "string",
      default: true,
      tag: "tag:yaml.org,2002:str",
      resolve: (str) => str,
      stringify(item, ctx, onComment, onChompKeep) {
        ctx = Object.assign({ actualString: true }, ctx);
        return stringifyString.stringifyString(item, ctx, onComment, onChompKeep);
      }
    };
    exports.string = string;
  }
});

// node_modules/yaml/dist/schema/common/null.js
var require_null = __commonJS({
  "node_modules/yaml/dist/schema/common/null.js"(exports) {
    "use strict";
    var Scalar2 = require_Scalar();
    var nullTag = {
      identify: (value) => value == null,
      createNode: () => new Scalar2.Scalar(null),
      default: true,
      tag: "tag:yaml.org,2002:null",
      test: /^(?:~|[Nn]ull|NULL)?$/,
      resolve: () => new Scalar2.Scalar(null),
      stringify: ({ source }, ctx) => typeof source === "string" && nullTag.test.test(source) ? source : ctx.options.nullStr
    };
    exports.nullTag = nullTag;
  }
});

// node_modules/yaml/dist/schema/core/bool.js
var require_bool = __commonJS({
  "node_modules/yaml/dist/schema/core/bool.js"(exports) {
    "use strict";
    var Scalar2 = require_Scalar();
    var boolTag = {
      identify: (value) => typeof value === "boolean",
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
      resolve: (str) => new Scalar2.Scalar(str[0] === "t" || str[0] === "T"),
      stringify({ source, value }, ctx) {
        if (source && boolTag.test.test(source)) {
          const sv = source[0] === "t" || source[0] === "T";
          if (value === sv)
            return source;
        }
        return value ? ctx.options.trueStr : ctx.options.falseStr;
      }
    };
    exports.boolTag = boolTag;
  }
});

// node_modules/yaml/dist/stringify/stringifyNumber.js
var require_stringifyNumber = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyNumber.js"(exports) {
    "use strict";
    function stringifyNumber({ format, minFractionDigits, tag, value }) {
      if (typeof value === "bigint")
        return String(value);
      const num = typeof value === "number" ? value : Number(value);
      if (!isFinite(num))
        return isNaN(num) ? ".nan" : num < 0 ? "-.inf" : ".inf";
      let n = Object.is(value, -0) ? "-0" : JSON.stringify(value);
      if (!format && minFractionDigits && (!tag || tag === "tag:yaml.org,2002:float") && /^-?\d/.test(n) && !n.includes("e")) {
        let i = n.indexOf(".");
        if (i < 0) {
          i = n.length;
          n += ".";
        }
        let d = minFractionDigits - (n.length - i - 1);
        while (d-- > 0)
          n += "0";
      }
      return n;
    }
    exports.stringifyNumber = stringifyNumber;
  }
});

// node_modules/yaml/dist/schema/core/float.js
var require_float = __commonJS({
  "node_modules/yaml/dist/schema/core/float.js"(exports) {
    "use strict";
    var Scalar2 = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
      resolve: (str) => parseFloat(str),
      stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
      resolve(str) {
        const node = new Scalar2.Scalar(parseFloat(str));
        const dot = str.indexOf(".");
        if (dot !== -1 && str[str.length - 1] === "0")
          node.minFractionDigits = str.length - dot - 1;
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports.float = float;
    exports.floatExp = floatExp;
    exports.floatNaN = floatNaN;
  }
});

// node_modules/yaml/dist/schema/core/int.js
var require_int = __commonJS({
  "node_modules/yaml/dist/schema/core/int.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    var intResolve = (str, offset, radix, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str.substring(offset), radix);
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value) && value >= 0)
        return prefix + value.toString(radix);
      return stringifyNumber.stringifyNumber(node);
    }
    var intOct = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^0o[0-7]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 8, opt),
      stringify: (node) => intStringify(node, 8, "0o")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: (value) => intIdentify(value) && value >= 0,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^0x[0-9a-fA-F]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports.int = int;
    exports.intHex = intHex;
    exports.intOct = intOct;
  }
});

// node_modules/yaml/dist/schema/core/schema.js
var require_schema = __commonJS({
  "node_modules/yaml/dist/schema/core/schema.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool.boolTag,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float
    ];
    exports.schema = schema;
  }
});

// node_modules/yaml/dist/schema/json/schema.js
var require_schema2 = __commonJS({
  "node_modules/yaml/dist/schema/json/schema.js"(exports) {
    "use strict";
    var Scalar2 = require_Scalar();
    var map = require_map();
    var seq = require_seq();
    function intIdentify(value) {
      return typeof value === "bigint" || Number.isInteger(value);
    }
    var stringifyJSON = ({ value }) => JSON.stringify(value);
    var jsonScalars = [
      {
        identify: (value) => typeof value === "string",
        default: true,
        tag: "tag:yaml.org,2002:str",
        resolve: (str) => str,
        stringify: stringifyJSON
      },
      {
        identify: (value) => value == null,
        createNode: () => new Scalar2.Scalar(null),
        default: true,
        tag: "tag:yaml.org,2002:null",
        test: /^null$/,
        resolve: () => null,
        stringify: stringifyJSON
      },
      {
        identify: (value) => typeof value === "boolean",
        default: true,
        tag: "tag:yaml.org,2002:bool",
        test: /^true$|^false$/,
        resolve: (str) => str === "true",
        stringify: stringifyJSON
      },
      {
        identify: intIdentify,
        default: true,
        tag: "tag:yaml.org,2002:int",
        test: /^-?(?:0|[1-9][0-9]*)$/,
        resolve: (str, _onError, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str, 10),
        stringify: ({ value }) => intIdentify(value) ? value.toString() : JSON.stringify(value)
      },
      {
        identify: (value) => typeof value === "number",
        default: true,
        tag: "tag:yaml.org,2002:float",
        test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
        resolve: (str) => parseFloat(str),
        stringify: stringifyJSON
      }
    ];
    var jsonError = {
      default: true,
      tag: "",
      test: /^/,
      resolve(str, onError) {
        onError(`Unresolved plain scalar ${JSON.stringify(str)}`);
        return str;
      }
    };
    var schema = [map.map, seq.seq].concat(jsonScalars, jsonError);
    exports.schema = schema;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/binary.js
var require_binary = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/binary.js"(exports) {
    "use strict";
    var node_buffer = __require("buffer");
    var Scalar2 = require_Scalar();
    var stringifyString = require_stringifyString();
    var binary = {
      identify: (value) => value instanceof Uint8Array,
      // Buffer inherits from Uint8Array
      default: false,
      tag: "tag:yaml.org,2002:binary",
      /**
       * Returns a Buffer in node and an Uint8Array in browsers
       *
       * To use the resulting buffer as an image, you'll want to do something like:
       *
       *   const blob = new Blob([buffer], { type: 'image/jpeg' })
       *   document.querySelector('#photo').src = URL.createObjectURL(blob)
       */
      resolve(src, onError) {
        if (typeof node_buffer.Buffer === "function") {
          return node_buffer.Buffer.from(src, "base64");
        } else if (typeof atob === "function") {
          const str = atob(src.replace(/[\n\r]/g, ""));
          const buffer = new Uint8Array(str.length);
          for (let i = 0; i < str.length; ++i)
            buffer[i] = str.charCodeAt(i);
          return buffer;
        } else {
          onError("This environment does not support reading binary tags; either Buffer or atob is required");
          return src;
        }
      },
      stringify({ comment, type, value }, ctx, onComment, onChompKeep) {
        if (!value)
          return "";
        const buf = value;
        let str;
        if (typeof node_buffer.Buffer === "function") {
          str = buf instanceof node_buffer.Buffer ? buf.toString("base64") : node_buffer.Buffer.from(buf.buffer).toString("base64");
        } else if (typeof btoa === "function") {
          let s = "";
          for (let i = 0; i < buf.length; ++i)
            s += String.fromCharCode(buf[i]);
          str = btoa(s);
        } else {
          throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");
        }
        type ?? (type = Scalar2.Scalar.BLOCK_LITERAL);
        if (type !== Scalar2.Scalar.QUOTE_DOUBLE) {
          const lineWidth = Math.max(ctx.options.lineWidth - ctx.indent.length, ctx.options.minContentWidth);
          const n = Math.ceil(str.length / lineWidth);
          const lines = new Array(n);
          for (let i = 0, o = 0; i < n; ++i, o += lineWidth) {
            lines[i] = str.substr(o, lineWidth);
          }
          str = lines.join(type === Scalar2.Scalar.BLOCK_LITERAL ? "\n" : " ");
        }
        return stringifyString.stringifyString({ comment, type, value: str }, ctx, onComment, onChompKeep);
      }
    };
    exports.binary = binary;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/pairs.js
var require_pairs = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/pairs.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar2 = require_Scalar();
    var YAMLSeq = require_YAMLSeq();
    function resolvePairs(seq, onError) {
      if (identity.isSeq(seq)) {
        for (let i = 0; i < seq.items.length; ++i) {
          let item = seq.items[i];
          if (identity.isPair(item))
            continue;
          else if (identity.isMap(item)) {
            if (item.items.length > 1)
              onError("Each pair must have its own sequence indicator");
            const pair = item.items[0] || new Pair.Pair(new Scalar2.Scalar(null));
            if (item.commentBefore)
              pair.key.commentBefore = pair.key.commentBefore ? `${item.commentBefore}
${pair.key.commentBefore}` : item.commentBefore;
            if (item.comment) {
              const cn = pair.value ?? pair.key;
              cn.comment = cn.comment ? `${item.comment}
${cn.comment}` : item.comment;
            }
            item = pair;
          }
          seq.items[i] = identity.isPair(item) ? item : new Pair.Pair(item);
        }
      } else
        onError("Expected a sequence for this tag");
      return seq;
    }
    function createPairs(schema, iterable, ctx) {
      const { replacer } = ctx;
      const pairs2 = new YAMLSeq.YAMLSeq(schema);
      pairs2.tag = "tag:yaml.org,2002:pairs";
      let i = 0;
      if (iterable && Symbol.iterator in Object(iterable))
        for (let it of iterable) {
          if (typeof replacer === "function")
            it = replacer.call(iterable, String(i++), it);
          let key, value;
          if (Array.isArray(it)) {
            if (it.length === 2) {
              key = it[0];
              value = it[1];
            } else
              throw new TypeError(`Expected [key, value] tuple: ${it}`);
          } else if (it && it instanceof Object) {
            const keys = Object.keys(it);
            if (keys.length === 1) {
              key = keys[0];
              value = it[key];
            } else {
              throw new TypeError(`Expected tuple with one key, not ${keys.length} keys`);
            }
          } else {
            key = it;
          }
          pairs2.items.push(Pair.createPair(key, value, ctx));
        }
      return pairs2;
    }
    var pairs = {
      collection: "seq",
      default: false,
      tag: "tag:yaml.org,2002:pairs",
      resolve: resolvePairs,
      createNode: createPairs
    };
    exports.createPairs = createPairs;
    exports.pairs = pairs;
    exports.resolvePairs = resolvePairs;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/omap.js
var require_omap = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/omap.js"(exports) {
    "use strict";
    var identity = require_identity();
    var toJS = require_toJS();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var pairs = require_pairs();
    var YAMLOMap = class _YAMLOMap extends YAMLSeq.YAMLSeq {
      constructor() {
        super();
        this.add = YAMLMap.YAMLMap.prototype.add.bind(this);
        this.delete = YAMLMap.YAMLMap.prototype.delete.bind(this);
        this.get = YAMLMap.YAMLMap.prototype.get.bind(this);
        this.has = YAMLMap.YAMLMap.prototype.has.bind(this);
        this.set = YAMLMap.YAMLMap.prototype.set.bind(this);
        this.tag = _YAMLOMap.tag;
      }
      /**
       * If `ctx` is given, the return type is actually `Map<unknown, unknown>`,
       * but TypeScript won't allow widening the signature of a child method.
       */
      toJSON(_, ctx) {
        if (!ctx)
          return super.toJSON(_);
        const map = /* @__PURE__ */ new Map();
        if (ctx?.onCreate)
          ctx.onCreate(map);
        for (const pair of this.items) {
          let key, value;
          if (identity.isPair(pair)) {
            key = toJS.toJS(pair.key, "", ctx);
            value = toJS.toJS(pair.value, key, ctx);
          } else {
            key = toJS.toJS(pair, "", ctx);
          }
          if (map.has(key))
            throw new Error("Ordered maps must not include duplicate keys");
          map.set(key, value);
        }
        return map;
      }
      static from(schema, iterable, ctx) {
        const pairs$1 = pairs.createPairs(schema, iterable, ctx);
        const omap2 = new this();
        omap2.items = pairs$1.items;
        return omap2;
      }
    };
    YAMLOMap.tag = "tag:yaml.org,2002:omap";
    var omap = {
      collection: "seq",
      identify: (value) => value instanceof Map,
      nodeClass: YAMLOMap,
      default: false,
      tag: "tag:yaml.org,2002:omap",
      resolve(seq, onError) {
        const pairs$1 = pairs.resolvePairs(seq, onError);
        const seenKeys = [];
        for (const { key } of pairs$1.items) {
          if (identity.isScalar(key)) {
            if (seenKeys.includes(key.value)) {
              onError(`Ordered maps must not include duplicate keys: ${key.value}`);
            } else {
              seenKeys.push(key.value);
            }
          }
        }
        return Object.assign(new YAMLOMap(), pairs$1);
      },
      createNode: (schema, iterable, ctx) => YAMLOMap.from(schema, iterable, ctx)
    };
    exports.YAMLOMap = YAMLOMap;
    exports.omap = omap;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/bool.js
var require_bool2 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/bool.js"(exports) {
    "use strict";
    var Scalar2 = require_Scalar();
    function boolStringify({ value, source }, ctx) {
      const boolObj = value ? trueTag : falseTag;
      if (source && boolObj.test.test(source))
        return source;
      return value ? ctx.options.trueStr : ctx.options.falseStr;
    }
    var trueTag = {
      identify: (value) => value === true,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
      resolve: () => new Scalar2.Scalar(true),
      stringify: boolStringify
    };
    var falseTag = {
      identify: (value) => value === false,
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,
      resolve: () => new Scalar2.Scalar(false),
      stringify: boolStringify
    };
    exports.falseTag = falseTag;
    exports.trueTag = trueTag;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/float.js
var require_float2 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/float.js"(exports) {
    "use strict";
    var Scalar2 = require_Scalar();
    var stringifyNumber = require_stringifyNumber();
    var floatNaN = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
      resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
      stringify: stringifyNumber.stringifyNumber
    };
    var floatExp = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "EXP",
      test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
      resolve: (str) => parseFloat(str.replace(/_/g, "")),
      stringify(node) {
        const num = Number(node.value);
        return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
      }
    };
    var float = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
      resolve(str) {
        const node = new Scalar2.Scalar(parseFloat(str.replace(/_/g, "")));
        const dot = str.indexOf(".");
        if (dot !== -1) {
          const f = str.substring(dot + 1).replace(/_/g, "");
          if (f[f.length - 1] === "0")
            node.minFractionDigits = f.length;
        }
        return node;
      },
      stringify: stringifyNumber.stringifyNumber
    };
    exports.float = float;
    exports.floatExp = floatExp;
    exports.floatNaN = floatNaN;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/int.js
var require_int2 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/int.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
    function intResolve(str, offset, radix, { intAsBigInt }) {
      const sign = str[0];
      if (sign === "-" || sign === "+")
        offset += 1;
      str = str.substring(offset).replace(/_/g, "");
      if (intAsBigInt) {
        switch (radix) {
          case 2:
            str = `0b${str}`;
            break;
          case 8:
            str = `0o${str}`;
            break;
          case 16:
            str = `0x${str}`;
            break;
        }
        const n2 = BigInt(str);
        return sign === "-" ? BigInt(-1) * n2 : n2;
      }
      const n = parseInt(str, radix);
      return sign === "-" ? -1 * n : n;
    }
    function intStringify(node, radix, prefix) {
      const { value } = node;
      if (intIdentify(value)) {
        const str = value.toString(radix);
        return value < 0 ? "-" + prefix + str.substr(1) : prefix + str;
      }
      return stringifyNumber.stringifyNumber(node);
    }
    var intBin = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "BIN",
      test: /^[-+]?0b[0-1_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 2, opt),
      stringify: (node) => intStringify(node, 2, "0b")
    };
    var intOct = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "OCT",
      test: /^[-+]?0[0-7_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 1, 8, opt),
      stringify: (node) => intStringify(node, 8, "0")
    };
    var int = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^[-+]?[0-9][0-9_]*$/,
      resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
      stringify: stringifyNumber.stringifyNumber
    };
    var intHex = {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "HEX",
      test: /^[-+]?0x[0-9a-fA-F_]+$/,
      resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
      stringify: (node) => intStringify(node, 16, "0x")
    };
    exports.int = int;
    exports.intBin = intBin;
    exports.intHex = intHex;
    exports.intOct = intOct;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/set.js
var require_set = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/set.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSet = class _YAMLSet extends YAMLMap.YAMLMap {
      constructor(schema) {
        super(schema);
        this.tag = _YAMLSet.tag;
      }
      add(key) {
        let pair;
        if (identity.isPair(key))
          pair = key;
        else if (key && typeof key === "object" && "key" in key && "value" in key && key.value === null)
          pair = new Pair.Pair(key.key, null);
        else
          pair = new Pair.Pair(key, null);
        const prev = YAMLMap.findPair(this.items, pair.key);
        if (!prev)
          this.items.push(pair);
      }
      /**
       * If `keepPair` is `true`, returns the Pair matching `key`.
       * Otherwise, returns the value of that Pair's key.
       */
      get(key, keepPair) {
        const pair = YAMLMap.findPair(this.items, key);
        return !keepPair && identity.isPair(pair) ? identity.isScalar(pair.key) ? pair.key.value : pair.key : pair;
      }
      set(key, value) {
        if (typeof value !== "boolean")
          throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof value}`);
        const prev = YAMLMap.findPair(this.items, key);
        if (prev && !value) {
          this.items.splice(this.items.indexOf(prev), 1);
        } else if (!prev && value) {
          this.items.push(new Pair.Pair(key));
        }
      }
      toJSON(_, ctx) {
        return super.toJSON(_, ctx, Set);
      }
      toString(ctx, onComment, onChompKeep) {
        if (!ctx)
          return JSON.stringify(this);
        if (this.hasAllNullValues(true))
          return super.toString(Object.assign({}, ctx, { allNullValues: true }), onComment, onChompKeep);
        else
          throw new Error("Set items must all have null values");
      }
      static from(schema, iterable, ctx) {
        const { replacer } = ctx;
        const set2 = new this(schema);
        if (iterable && Symbol.iterator in Object(iterable))
          for (let value of iterable) {
            if (typeof replacer === "function")
              value = replacer.call(iterable, value, value);
            set2.items.push(Pair.createPair(value, null, ctx));
          }
        return set2;
      }
    };
    YAMLSet.tag = "tag:yaml.org,2002:set";
    var set = {
      collection: "map",
      identify: (value) => value instanceof Set,
      nodeClass: YAMLSet,
      default: false,
      tag: "tag:yaml.org,2002:set",
      createNode: (schema, iterable, ctx) => YAMLSet.from(schema, iterable, ctx),
      resolve(map, onError) {
        if (identity.isMap(map)) {
          if (map.hasAllNullValues(true))
            return Object.assign(new YAMLSet(), map);
          else
            onError("Set items must all have null values");
        } else
          onError("Expected a mapping for this tag");
        return map;
      }
    };
    exports.YAMLSet = YAMLSet;
    exports.set = set;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/timestamp.js
var require_timestamp = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/timestamp.js"(exports) {
    "use strict";
    var stringifyNumber = require_stringifyNumber();
    function parseSexagesimal(str, asBigInt) {
      const sign = str[0];
      const parts = sign === "-" || sign === "+" ? str.substring(1) : str;
      const num = (n) => asBigInt ? BigInt(n) : Number(n);
      const res = parts.replace(/_/g, "").split(":").reduce((res2, p) => res2 * num(60) + num(p), num(0));
      return sign === "-" ? num(-1) * res : res;
    }
    function stringifySexagesimal(node) {
      let { value } = node;
      let num = (n) => n;
      if (typeof value === "bigint")
        num = (n) => BigInt(n);
      else if (isNaN(value) || !isFinite(value))
        return stringifyNumber.stringifyNumber(node);
      let sign = "";
      if (value < 0) {
        sign = "-";
        value *= num(-1);
      }
      const _60 = num(60);
      const parts = [value % _60];
      if (value < 60) {
        parts.unshift(0);
      } else {
        value = (value - parts[0]) / _60;
        parts.unshift(value % _60);
        if (value >= 60) {
          value = (value - parts[0]) / _60;
          parts.unshift(value);
        }
      }
      return sign + parts.map((n) => String(n).padStart(2, "0")).join(":").replace(/000000\d*$/, "");
    }
    var intTime = {
      identify: (value) => typeof value === "bigint" || Number.isInteger(value),
      default: true,
      tag: "tag:yaml.org,2002:int",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
      resolve: (str, _onError, { intAsBigInt }) => parseSexagesimal(str, intAsBigInt),
      stringify: stringifySexagesimal
    };
    var floatTime = {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      format: "TIME",
      test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
      resolve: (str) => parseSexagesimal(str, false),
      stringify: stringifySexagesimal
    };
    var timestamp = {
      identify: (value) => value instanceof Date,
      default: true,
      tag: "tag:yaml.org,2002:timestamp",
      // If the time zone is omitted, the timestamp is assumed to be specified in UTC. The time part
      // may be omitted altogether, resulting in a date format. In such a case, the time part is
      // assumed to be 00:00:00Z (start of day, UTC).
      test: RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:t|T|[ \\t]+)([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$"),
      resolve(str) {
        const match = str.match(timestamp.test);
        if (!match)
          throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");
        const [, year, month, day, hour, minute, second] = match.map(Number);
        const millisec = match[7] ? Number((match[7] + "00").substr(1, 3)) : 0;
        let date = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
        const tz = match[8];
        if (tz && tz !== "Z") {
          let d = parseSexagesimal(tz, false);
          if (Math.abs(d) < 30)
            d *= 60;
          date -= 6e4 * d;
        }
        return new Date(date);
      },
      stringify: ({ value }) => value?.toISOString().replace(/(T00:00:00)?\.000Z$/, "") ?? ""
    };
    exports.floatTime = floatTime;
    exports.intTime = intTime;
    exports.timestamp = timestamp;
  }
});

// node_modules/yaml/dist/schema/yaml-1.1/schema.js
var require_schema3 = __commonJS({
  "node_modules/yaml/dist/schema/yaml-1.1/schema.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var binary = require_binary();
    var bool = require_bool2();
    var float = require_float2();
    var int = require_int2();
    var merge = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var set = require_set();
    var timestamp = require_timestamp();
    var schema = [
      map.map,
      seq.seq,
      string.string,
      _null.nullTag,
      bool.trueTag,
      bool.falseTag,
      int.intBin,
      int.intOct,
      int.int,
      int.intHex,
      float.floatNaN,
      float.floatExp,
      float.float,
      binary.binary,
      merge.merge,
      omap.omap,
      pairs.pairs,
      set.set,
      timestamp.intTime,
      timestamp.floatTime,
      timestamp.timestamp
    ];
    exports.schema = schema;
  }
});

// node_modules/yaml/dist/schema/tags.js
var require_tags = __commonJS({
  "node_modules/yaml/dist/schema/tags.js"(exports) {
    "use strict";
    var map = require_map();
    var _null = require_null();
    var seq = require_seq();
    var string = require_string();
    var bool = require_bool();
    var float = require_float();
    var int = require_int();
    var schema = require_schema();
    var schema$1 = require_schema2();
    var binary = require_binary();
    var merge = require_merge();
    var omap = require_omap();
    var pairs = require_pairs();
    var schema$2 = require_schema3();
    var set = require_set();
    var timestamp = require_timestamp();
    var schemas = /* @__PURE__ */ new Map([
      ["core", schema.schema],
      ["failsafe", [map.map, seq.seq, string.string]],
      ["json", schema$1.schema],
      ["yaml11", schema$2.schema],
      ["yaml-1.1", schema$2.schema]
    ]);
    var tagsByName = {
      binary: binary.binary,
      bool: bool.boolTag,
      float: float.float,
      floatExp: float.floatExp,
      floatNaN: float.floatNaN,
      floatTime: timestamp.floatTime,
      int: int.int,
      intHex: int.intHex,
      intOct: int.intOct,
      intTime: timestamp.intTime,
      map: map.map,
      merge: merge.merge,
      null: _null.nullTag,
      omap: omap.omap,
      pairs: pairs.pairs,
      seq: seq.seq,
      set: set.set,
      timestamp: timestamp.timestamp
    };
    var coreKnownTags = {
      "tag:yaml.org,2002:binary": binary.binary,
      "tag:yaml.org,2002:merge": merge.merge,
      "tag:yaml.org,2002:omap": omap.omap,
      "tag:yaml.org,2002:pairs": pairs.pairs,
      "tag:yaml.org,2002:set": set.set,
      "tag:yaml.org,2002:timestamp": timestamp.timestamp
    };
    function getTags(customTags, schemaName, addMergeTag) {
      const schemaTags = schemas.get(schemaName);
      if (schemaTags && !customTags) {
        return addMergeTag && !schemaTags.includes(merge.merge) ? schemaTags.concat(merge.merge) : schemaTags.slice();
      }
      let tags = schemaTags;
      if (!tags) {
        if (Array.isArray(customTags))
          tags = [];
        else {
          const keys = Array.from(schemas.keys()).filter((key) => key !== "yaml11").map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown schema "${schemaName}"; use one of ${keys} or define customTags array`);
        }
      }
      if (Array.isArray(customTags)) {
        for (const tag of customTags)
          tags = tags.concat(tag);
      } else if (typeof customTags === "function") {
        tags = customTags(tags.slice());
      }
      if (addMergeTag)
        tags = tags.concat(merge.merge);
      return tags.reduce((tags2, tag) => {
        const tagObj = typeof tag === "string" ? tagsByName[tag] : tag;
        if (!tagObj) {
          const tagName = JSON.stringify(tag);
          const keys = Object.keys(tagsByName).map((key) => JSON.stringify(key)).join(", ");
          throw new Error(`Unknown custom tag ${tagName}; use one of ${keys}`);
        }
        if (!tags2.includes(tagObj))
          tags2.push(tagObj);
        return tags2;
      }, []);
    }
    exports.coreKnownTags = coreKnownTags;
    exports.getTags = getTags;
  }
});

// node_modules/yaml/dist/schema/Schema.js
var require_Schema = __commonJS({
  "node_modules/yaml/dist/schema/Schema.js"(exports) {
    "use strict";
    var identity = require_identity();
    var map = require_map();
    var seq = require_seq();
    var string = require_string();
    var tags = require_tags();
    var sortMapEntriesByKey = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    var Schema = class _Schema {
      constructor({ compat, customTags, merge, resolveKnownTags, schema, sortMapEntries, toStringDefaults }) {
        this.compat = Array.isArray(compat) ? tags.getTags(compat, "compat") : compat ? tags.getTags(null, compat) : null;
        this.name = typeof schema === "string" && schema || "core";
        this.knownTags = resolveKnownTags ? tags.coreKnownTags : {};
        this.tags = tags.getTags(customTags, this.name, merge);
        this.toStringOptions = toStringDefaults ?? null;
        Object.defineProperty(this, identity.MAP, { value: map.map });
        Object.defineProperty(this, identity.SCALAR, { value: string.string });
        Object.defineProperty(this, identity.SEQ, { value: seq.seq });
        this.sortMapEntries = typeof sortMapEntries === "function" ? sortMapEntries : sortMapEntries === true ? sortMapEntriesByKey : null;
      }
      clone() {
        const copy = Object.create(_Schema.prototype, Object.getOwnPropertyDescriptors(this));
        copy.tags = this.tags.slice();
        return copy;
      }
    };
    exports.Schema = Schema;
  }
});

// node_modules/yaml/dist/stringify/stringifyDocument.js
var require_stringifyDocument = __commonJS({
  "node_modules/yaml/dist/stringify/stringifyDocument.js"(exports) {
    "use strict";
    var identity = require_identity();
    var stringify = require_stringify();
    var stringifyComment = require_stringifyComment();
    function stringifyDocument(doc, options) {
      const lines = [];
      let hasDirectives = options.directives === true;
      if (options.directives !== false && doc.directives) {
        const dir = doc.directives.toString(doc);
        if (dir) {
          lines.push(dir);
          hasDirectives = true;
        } else if (doc.directives.docStart)
          hasDirectives = true;
      }
      if (hasDirectives)
        lines.push("---");
      const ctx = stringify.createStringifyContext(doc, options);
      const { commentString } = ctx.options;
      if (doc.commentBefore) {
        if (lines.length !== 1)
          lines.unshift("");
        const cs = commentString(doc.commentBefore);
        lines.unshift(stringifyComment.indentComment(cs, ""));
      }
      let chompKeep = false;
      let contentComment = null;
      if (doc.contents) {
        if (identity.isNode(doc.contents)) {
          if (doc.contents.spaceBefore && hasDirectives)
            lines.push("");
          if (doc.contents.commentBefore) {
            const cs = commentString(doc.contents.commentBefore);
            lines.push(stringifyComment.indentComment(cs, ""));
          }
          ctx.forceBlockIndent = !!doc.comment;
          contentComment = doc.contents.comment;
        }
        const onChompKeep = contentComment ? void 0 : () => chompKeep = true;
        let body = stringify.stringify(doc.contents, ctx, () => contentComment = null, onChompKeep);
        if (contentComment)
          body += stringifyComment.lineComment(body, "", commentString(contentComment));
        if ((body[0] === "|" || body[0] === ">") && lines[lines.length - 1] === "---") {
          lines[lines.length - 1] = `--- ${body}`;
        } else
          lines.push(body);
      } else {
        lines.push(stringify.stringify(doc.contents, ctx));
      }
      if (doc.directives?.docEnd) {
        if (doc.comment) {
          const cs = commentString(doc.comment);
          if (cs.includes("\n")) {
            lines.push("...");
            lines.push(stringifyComment.indentComment(cs, ""));
          } else {
            lines.push(`... ${cs}`);
          }
        } else {
          lines.push("...");
        }
      } else {
        let dc = doc.comment;
        if (dc && chompKeep)
          dc = dc.replace(/^\n+/, "");
        if (dc) {
          if ((!chompKeep || contentComment) && lines[lines.length - 1] !== "")
            lines.push("");
          lines.push(stringifyComment.indentComment(commentString(dc), ""));
        }
      }
      return lines.join("\n") + "\n";
    }
    exports.stringifyDocument = stringifyDocument;
  }
});

// node_modules/yaml/dist/doc/Document.js
var require_Document = __commonJS({
  "node_modules/yaml/dist/doc/Document.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var Collection = require_Collection();
    var identity = require_identity();
    var Pair = require_Pair();
    var toJS = require_toJS();
    var Schema = require_Schema();
    var stringifyDocument = require_stringifyDocument();
    var anchors = require_anchors();
    var applyReviver = require_applyReviver();
    var createNode = require_createNode();
    var directives = require_directives();
    var Document = class _Document {
      constructor(value, replacer, options) {
        this.commentBefore = null;
        this.comment = null;
        this.errors = [];
        this.warnings = [];
        Object.defineProperty(this, identity.NODE_TYPE, { value: identity.DOC });
        let _replacer = null;
        if (typeof replacer === "function" || Array.isArray(replacer)) {
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const opt = Object.assign({
          intAsBigInt: false,
          keepSourceTokens: false,
          logLevel: "warn",
          prettyErrors: true,
          strict: true,
          stringKeys: false,
          uniqueKeys: true,
          version: "1.2"
        }, options);
        this.options = opt;
        let { version } = opt;
        if (options?._directives) {
          this.directives = options._directives.atDocument();
          if (this.directives.yaml.explicit)
            version = this.directives.yaml.version;
        } else
          this.directives = new directives.Directives({ version });
        this.setSchema(version, options);
        this.contents = value === void 0 ? null : this.createNode(value, _replacer, options);
      }
      /**
       * Create a deep copy of this Document and its contents.
       *
       * Custom Node values that inherit from `Object` still refer to their original instances.
       */
      clone() {
        const copy = Object.create(_Document.prototype, {
          [identity.NODE_TYPE]: { value: identity.DOC }
        });
        copy.commentBefore = this.commentBefore;
        copy.comment = this.comment;
        copy.errors = this.errors.slice();
        copy.warnings = this.warnings.slice();
        copy.options = Object.assign({}, this.options);
        if (this.directives)
          copy.directives = this.directives.clone();
        copy.schema = this.schema.clone();
        copy.contents = identity.isNode(this.contents) ? this.contents.clone(copy.schema) : this.contents;
        if (this.range)
          copy.range = this.range.slice();
        return copy;
      }
      /** Adds a value to the document. */
      add(value) {
        if (assertCollection(this.contents))
          this.contents.add(value);
      }
      /** Adds a value to the document. */
      addIn(path, value) {
        if (assertCollection(this.contents))
          this.contents.addIn(path, value);
      }
      /**
       * Create a new `Alias` node, ensuring that the target `node` has the required anchor.
       *
       * If `node` already has an anchor, `name` is ignored.
       * Otherwise, the `node.anchor` value will be set to `name`,
       * or if an anchor with that name is already present in the document,
       * `name` will be used as a prefix for a new unique anchor.
       * If `name` is undefined, the generated anchor will use 'a' as a prefix.
       */
      createAlias(node, name) {
        if (!node.anchor) {
          const prev = anchors.anchorNames(this);
          node.anchor = // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          !name || prev.has(name) ? anchors.findNewAnchor(name || "a", prev) : name;
        }
        return new Alias.Alias(node.anchor);
      }
      createNode(value, replacer, options) {
        let _replacer = void 0;
        if (typeof replacer === "function") {
          value = replacer.call({ "": value }, "", value);
          _replacer = replacer;
        } else if (Array.isArray(replacer)) {
          const keyToStr = (v) => typeof v === "number" || v instanceof String || v instanceof Number;
          const asStr = replacer.filter(keyToStr).map(String);
          if (asStr.length > 0)
            replacer = replacer.concat(asStr);
          _replacer = replacer;
        } else if (options === void 0 && replacer) {
          options = replacer;
          replacer = void 0;
        }
        const { aliasDuplicateObjects, anchorPrefix, flow, keepUndefined, onTagObj, tag } = options ?? {};
        const { onAnchor, setAnchors, sourceObjects } = anchors.createNodeAnchors(
          this,
          // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          anchorPrefix || "a"
        );
        const ctx = {
          aliasDuplicateObjects: aliasDuplicateObjects ?? true,
          keepUndefined: keepUndefined ?? false,
          onAnchor,
          onTagObj,
          replacer: _replacer,
          schema: this.schema,
          sourceObjects
        };
        const node = createNode.createNode(value, tag, ctx);
        if (flow && identity.isCollection(node))
          node.flow = true;
        setAnchors();
        return node;
      }
      /**
       * Convert a key and a value into a `Pair` using the current schema,
       * recursively wrapping all values as `Scalar` or `Collection` nodes.
       */
      createPair(key, value, options = {}) {
        const k = this.createNode(key, null, options);
        const v = this.createNode(value, null, options);
        return new Pair.Pair(k, v);
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      delete(key) {
        return assertCollection(this.contents) ? this.contents.delete(key) : false;
      }
      /**
       * Removes a value from the document.
       * @returns `true` if the item was found and removed.
       */
      deleteIn(path) {
        if (Collection.isEmptyPath(path)) {
          if (this.contents == null)
            return false;
          this.contents = null;
          return true;
        }
        return assertCollection(this.contents) ? this.contents.deleteIn(path) : false;
      }
      /**
       * Returns item at `key`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      get(key, keepScalar) {
        return identity.isCollection(this.contents) ? this.contents.get(key, keepScalar) : void 0;
      }
      /**
       * Returns item at `path`, or `undefined` if not found. By default unwraps
       * scalar values from their surrounding node; to disable set `keepScalar` to
       * `true` (collections are always returned intact).
       */
      getIn(path, keepScalar) {
        if (Collection.isEmptyPath(path))
          return !keepScalar && identity.isScalar(this.contents) ? this.contents.value : this.contents;
        return identity.isCollection(this.contents) ? this.contents.getIn(path, keepScalar) : void 0;
      }
      /**
       * Checks if the document includes a value with the key `key`.
       */
      has(key) {
        return identity.isCollection(this.contents) ? this.contents.has(key) : false;
      }
      /**
       * Checks if the document includes a value at `path`.
       */
      hasIn(path) {
        if (Collection.isEmptyPath(path))
          return this.contents !== void 0;
        return identity.isCollection(this.contents) ? this.contents.hasIn(path) : false;
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      set(key, value) {
        if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, [key], value);
        } else if (assertCollection(this.contents)) {
          this.contents.set(key, value);
        }
      }
      /**
       * Sets a value in this document. For `!!set`, `value` needs to be a
       * boolean to add/remove the item from the set.
       */
      setIn(path, value) {
        if (Collection.isEmptyPath(path)) {
          this.contents = value;
        } else if (this.contents == null) {
          this.contents = Collection.collectionFromPath(this.schema, Array.from(path), value);
        } else if (assertCollection(this.contents)) {
          this.contents.setIn(path, value);
        }
      }
      /**
       * Change the YAML version and schema used by the document.
       * A `null` version disables support for directives, explicit tags, anchors, and aliases.
       * It also requires the `schema` option to be given as a `Schema` instance value.
       *
       * Overrides all previously set schema options.
       */
      setSchema(version, options = {}) {
        if (typeof version === "number")
          version = String(version);
        let opt;
        switch (version) {
          case "1.1":
            if (this.directives)
              this.directives.yaml.version = "1.1";
            else
              this.directives = new directives.Directives({ version: "1.1" });
            opt = { resolveKnownTags: false, schema: "yaml-1.1" };
            break;
          case "1.2":
          case "next":
            if (this.directives)
              this.directives.yaml.version = version;
            else
              this.directives = new directives.Directives({ version });
            opt = { resolveKnownTags: true, schema: "core" };
            break;
          case null:
            if (this.directives)
              delete this.directives;
            opt = null;
            break;
          default: {
            const sv = JSON.stringify(version);
            throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${sv}`);
          }
        }
        if (options.schema instanceof Object)
          this.schema = options.schema;
        else if (opt)
          this.schema = new Schema.Schema(Object.assign(opt, options));
        else
          throw new Error(`With a null YAML version, the { schema: Schema } option is required`);
      }
      // json & jsonArg are only used from toJSON()
      toJS({ json, jsonArg, mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
        const ctx = {
          anchors: /* @__PURE__ */ new Map(),
          doc: this,
          keep: !json,
          mapAsMap: mapAsMap === true,
          mapKeyWarned: false,
          maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
        };
        const res = toJS.toJS(this.contents, jsonArg ?? "", ctx);
        if (typeof onAnchor === "function")
          for (const { count, res: res2 } of ctx.anchors.values())
            onAnchor(res2, count);
        return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
      }
      /**
       * A JSON representation of the document `contents`.
       *
       * @param jsonArg Used by `JSON.stringify` to indicate the array index or
       *   property name.
       */
      toJSON(jsonArg, onAnchor) {
        return this.toJS({ json: true, jsonArg, mapAsMap: false, onAnchor });
      }
      /** A YAML representation of the document. */
      toString(options = {}) {
        if (this.errors.length > 0)
          throw new Error("Document with errors cannot be stringified");
        if ("indent" in options && (!Number.isInteger(options.indent) || Number(options.indent) <= 0)) {
          const s = JSON.stringify(options.indent);
          throw new Error(`"indent" option must be a positive integer, not ${s}`);
        }
        return stringifyDocument.stringifyDocument(this, options);
      }
    };
    function assertCollection(contents) {
      if (identity.isCollection(contents))
        return true;
      throw new Error("Expected a YAML collection as document contents");
    }
    exports.Document = Document;
  }
});

// node_modules/yaml/dist/errors.js
var require_errors = __commonJS({
  "node_modules/yaml/dist/errors.js"(exports) {
    "use strict";
    var YAMLError = class extends Error {
      constructor(name, pos, code, message) {
        super();
        this.name = name;
        this.code = code;
        this.message = message;
        this.pos = pos;
      }
    };
    var YAMLParseError = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLParseError", pos, code, message);
      }
    };
    var YAMLWarning = class extends YAMLError {
      constructor(pos, code, message) {
        super("YAMLWarning", pos, code, message);
      }
    };
    var prettifyError = (src, lc) => (error) => {
      if (error.pos[0] === -1)
        return;
      error.linePos = error.pos.map((pos) => lc.linePos(pos));
      const { line, col } = error.linePos[0];
      error.message += ` at line ${line}, column ${col}`;
      let ci = col - 1;
      let lineStr = src.substring(lc.lineStarts[line - 1], lc.lineStarts[line]).replace(/[\n\r]+$/, "");
      if (ci >= 60 && lineStr.length > 80) {
        const trimStart = Math.min(ci - 39, lineStr.length - 79);
        lineStr = "\u2026" + lineStr.substring(trimStart);
        ci -= trimStart - 1;
      }
      if (lineStr.length > 80)
        lineStr = lineStr.substring(0, 79) + "\u2026";
      if (line > 1 && /^ *$/.test(lineStr.substring(0, ci))) {
        let prev = src.substring(lc.lineStarts[line - 2], lc.lineStarts[line - 1]);
        if (prev.length > 80)
          prev = prev.substring(0, 79) + "\u2026\n";
        lineStr = prev + lineStr;
      }
      if (/[^ ]/.test(lineStr)) {
        let count = 1;
        const end = error.linePos[1];
        if (end?.line === line && end.col > col) {
          count = Math.max(1, Math.min(end.col - col, 80 - ci));
        }
        const pointer = " ".repeat(ci) + "^".repeat(count);
        error.message += `:

${lineStr}
${pointer}
`;
      }
    };
    exports.YAMLError = YAMLError;
    exports.YAMLParseError = YAMLParseError;
    exports.YAMLWarning = YAMLWarning;
    exports.prettifyError = prettifyError;
  }
});

// node_modules/yaml/dist/compose/resolve-props.js
var require_resolve_props = __commonJS({
  "node_modules/yaml/dist/compose/resolve-props.js"(exports) {
    "use strict";
    function resolveProps(tokens, { flow, indicator, next, offset, onError, parentIndent, startOnNewline }) {
      let spaceBefore = false;
      let atNewline = startOnNewline;
      let hasSpace = startOnNewline;
      let comment = "";
      let commentSep = "";
      let hasNewline = false;
      let reqSpace = false;
      let tab = null;
      let anchor = null;
      let tag = null;
      let newlineAfterProp = null;
      let comma = null;
      let found = null;
      let start = null;
      for (const token of tokens) {
        if (reqSpace) {
          if (token.type !== "space" && token.type !== "newline" && token.type !== "comma")
            onError(token.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
          reqSpace = false;
        }
        if (tab) {
          if (atNewline && token.type !== "comment" && token.type !== "newline") {
            onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
          }
          tab = null;
        }
        switch (token.type) {
          case "space":
            if (!flow && (indicator !== "doc-start" || next?.type !== "flow-collection") && token.source.includes("	")) {
              tab = token;
            }
            hasSpace = true;
            break;
          case "comment": {
            if (!hasSpace)
              onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
            const cb = token.source.substring(1) || " ";
            if (!comment)
              comment = cb;
            else
              comment += commentSep + cb;
            commentSep = "";
            atNewline = false;
            break;
          }
          case "newline":
            if (atNewline) {
              if (comment)
                comment += token.source;
              else if (!found || indicator !== "seq-item-ind")
                spaceBefore = true;
            } else
              commentSep += token.source;
            atNewline = true;
            hasNewline = true;
            if (anchor || tag)
              newlineAfterProp = token;
            hasSpace = true;
            break;
          case "anchor":
            if (anchor)
              onError(token, "MULTIPLE_ANCHORS", "A node can have at most one anchor");
            if (token.source.endsWith(":"))
              onError(token.offset + token.source.length - 1, "BAD_ALIAS", "Anchor ending in : is ambiguous", true);
            anchor = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          case "tag": {
            if (tag)
              onError(token, "MULTIPLE_TAGS", "A node can have at most one tag");
            tag = token;
            start ?? (start = token.offset);
            atNewline = false;
            hasSpace = false;
            reqSpace = true;
            break;
          }
          case indicator:
            if (anchor || tag)
              onError(token, "BAD_PROP_ORDER", `Anchors and tags must be after the ${token.source} indicator`);
            if (found)
              onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.source} in ${flow ?? "collection"}`);
            found = token;
            atNewline = indicator === "seq-item-ind" || indicator === "explicit-key-ind";
            hasSpace = false;
            break;
          case "comma":
            if (flow) {
              if (comma)
                onError(token, "UNEXPECTED_TOKEN", `Unexpected , in ${flow}`);
              comma = token;
              atNewline = false;
              hasSpace = false;
              break;
            }
          // else fallthrough
          default:
            onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.type} token`);
            atNewline = false;
            hasSpace = false;
        }
      }
      const last = tokens[tokens.length - 1];
      const end = last ? last.offset + last.source.length : offset;
      if (reqSpace && next && next.type !== "space" && next.type !== "newline" && next.type !== "comma" && (next.type !== "scalar" || next.source !== "")) {
        onError(next.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
      }
      if (tab && (atNewline && tab.indent <= parentIndent || next?.type === "block-map" || next?.type === "block-seq"))
        onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
      return {
        comma,
        found,
        spaceBefore,
        comment,
        hasNewline,
        anchor,
        tag,
        newlineAfterProp,
        end,
        start: start ?? end
      };
    }
    exports.resolveProps = resolveProps;
  }
});

// node_modules/yaml/dist/compose/util-contains-newline.js
var require_util_contains_newline = __commonJS({
  "node_modules/yaml/dist/compose/util-contains-newline.js"(exports) {
    "use strict";
    function containsNewline(key) {
      if (!key)
        return null;
      switch (key.type) {
        case "alias":
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          if (key.source.includes("\n"))
            return true;
          if (key.end) {
            for (const st of key.end)
              if (st.type === "newline")
                return true;
          }
          return false;
        case "flow-collection":
          for (const it of key.items) {
            for (const st of it.start)
              if (st.type === "newline")
                return true;
            if (it.sep) {
              for (const st of it.sep)
                if (st.type === "newline")
                  return true;
            }
            if (containsNewline(it.key) || containsNewline(it.value))
              return true;
          }
          return false;
        default:
          return true;
      }
    }
    exports.containsNewline = containsNewline;
  }
});

// node_modules/yaml/dist/compose/util-flow-indent-check.js
var require_util_flow_indent_check = __commonJS({
  "node_modules/yaml/dist/compose/util-flow-indent-check.js"(exports) {
    "use strict";
    var utilContainsNewline = require_util_contains_newline();
    function flowIndentCheck(indent, fc, onError) {
      if (fc?.type === "flow-collection") {
        const end = fc.end[0];
        if (end.indent === indent && (end.source === "]" || end.source === "}") && utilContainsNewline.containsNewline(fc)) {
          const msg = "Flow end indicator should be more indented than parent";
          onError(end, "BAD_INDENT", msg, true);
        }
      }
    }
    exports.flowIndentCheck = flowIndentCheck;
  }
});

// node_modules/yaml/dist/compose/util-map-includes.js
var require_util_map_includes = __commonJS({
  "node_modules/yaml/dist/compose/util-map-includes.js"(exports) {
    "use strict";
    var identity = require_identity();
    function mapIncludes(ctx, items2, search) {
      const { uniqueKeys } = ctx.options;
      if (uniqueKeys === false)
        return false;
      const isEqual = typeof uniqueKeys === "function" ? uniqueKeys : (a, b) => a === b || identity.isScalar(a) && identity.isScalar(b) && a.value === b.value;
      return items2.some((pair) => isEqual(pair.key, search));
    }
    exports.mapIncludes = mapIncludes;
  }
});

// node_modules/yaml/dist/compose/resolve-block-map.js
var require_resolve_block_map = __commonJS({
  "node_modules/yaml/dist/compose/resolve-block-map.js"(exports) {
    "use strict";
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    var utilMapIncludes = require_util_map_includes();
    var startColMsg = "All mapping items must start at the same column";
    function resolveBlockMap({ composeNode, composeEmptyNode }, ctx, bm, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLMap.YAMLMap;
      const map = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      let offset = bm.offset;
      let commentEnd = null;
      for (const collItem of bm.items) {
        const { start, key, sep, value } = collItem;
        const keyProps = resolveProps.resolveProps(start, {
          indicator: "explicit-key-ind",
          next: key ?? sep?.[0],
          offset,
          onError,
          parentIndent: bm.indent,
          startOnNewline: true
        });
        const implicitKey = !keyProps.found;
        if (implicitKey) {
          if (key) {
            if (key.type === "block-seq")
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "A block sequence may not be used as an implicit map key");
            else if ("indent" in key && key.indent !== bm.indent)
              onError(offset, "BAD_INDENT", startColMsg);
          }
          if (!keyProps.anchor && !keyProps.tag && !sep) {
            commentEnd = keyProps.end;
            if (keyProps.comment) {
              if (map.comment)
                map.comment += "\n" + keyProps.comment;
              else
                map.comment = keyProps.comment;
            }
            continue;
          }
          if (keyProps.newlineAfterProp || utilContainsNewline.containsNewline(key)) {
            onError(key ?? start[start.length - 1], "MULTILINE_IMPLICIT_KEY", "Implicit keys need to be on a single line");
          }
        } else if (keyProps.found?.indent !== bm.indent) {
          onError(offset, "BAD_INDENT", startColMsg);
        }
        ctx.atKey = true;
        const keyStart = keyProps.end;
        const keyNode = key ? composeNode(ctx, key, keyProps, onError) : composeEmptyNode(ctx, keyStart, start, null, keyProps, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bm.indent, key, onError);
        ctx.atKey = false;
        if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
          onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
        const valueProps = resolveProps.resolveProps(sep ?? [], {
          indicator: "map-value-ind",
          next: value,
          offset: keyNode.range[2],
          onError,
          parentIndent: bm.indent,
          startOnNewline: !key || key.type === "block-scalar"
        });
        offset = valueProps.end;
        if (valueProps.found) {
          if (implicitKey) {
            if (value?.type === "block-map" && !valueProps.hasNewline)
              onError(offset, "BLOCK_AS_IMPLICIT_KEY", "Nested mappings are not allowed in compact mappings");
            if (ctx.options.strict && keyProps.start < valueProps.found.offset - 1024)
              onError(keyNode.range, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit block mapping key");
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : composeEmptyNode(ctx, offset, sep, null, valueProps, onError);
          if (ctx.schema.compat)
            utilFlowIndentCheck.flowIndentCheck(bm.indent, value, onError);
          offset = valueNode.range[2];
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        } else {
          if (implicitKey)
            onError(keyNode.range, "MISSING_CHAR", "Implicit map keys need to be followed by map values");
          if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          map.items.push(pair);
        }
      }
      if (commentEnd && commentEnd < offset)
        onError(commentEnd, "IMPOSSIBLE", "Map comment with trailing content");
      map.range = [bm.offset, offset, commentEnd ?? offset];
      return map;
    }
    exports.resolveBlockMap = resolveBlockMap;
  }
});

// node_modules/yaml/dist/compose/resolve-block-seq.js
var require_resolve_block_seq = __commonJS({
  "node_modules/yaml/dist/compose/resolve-block-seq.js"(exports) {
    "use strict";
    var YAMLSeq = require_YAMLSeq();
    var resolveProps = require_resolve_props();
    var utilFlowIndentCheck = require_util_flow_indent_check();
    function resolveBlockSeq({ composeNode, composeEmptyNode }, ctx, bs, onError, tag) {
      const NodeClass = tag?.nodeClass ?? YAMLSeq.YAMLSeq;
      const seq = new NodeClass(ctx.schema);
      if (ctx.atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = bs.offset;
      let commentEnd = null;
      for (const { start, value } of bs.items) {
        const props = resolveProps.resolveProps(start, {
          indicator: "seq-item-ind",
          next: value,
          offset,
          onError,
          parentIndent: bs.indent,
          startOnNewline: true
        });
        if (!props.found) {
          if (props.anchor || props.tag || value) {
            if (value?.type === "block-seq")
              onError(props.end, "BAD_INDENT", "All sequence items must start at the same column");
            else
              onError(offset, "MISSING_CHAR", "Sequence item without - indicator");
          } else {
            commentEnd = props.end;
            if (props.comment)
              seq.comment = props.comment;
            continue;
          }
        }
        const node = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, start, null, props, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bs.indent, value, onError);
        offset = node.range[2];
        seq.items.push(node);
      }
      seq.range = [bs.offset, offset, commentEnd ?? offset];
      return seq;
    }
    exports.resolveBlockSeq = resolveBlockSeq;
  }
});

// node_modules/yaml/dist/compose/resolve-end.js
var require_resolve_end = __commonJS({
  "node_modules/yaml/dist/compose/resolve-end.js"(exports) {
    "use strict";
    function resolveEnd(end, offset, reqSpace, onError) {
      let comment = "";
      if (end) {
        let hasSpace = false;
        let sep = "";
        for (const token of end) {
          const { source, type } = token;
          switch (type) {
            case "space":
              hasSpace = true;
              break;
            case "comment": {
              if (reqSpace && !hasSpace)
                onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
              const cb = source.substring(1) || " ";
              if (!comment)
                comment = cb;
              else
                comment += sep + cb;
              sep = "";
              break;
            }
            case "newline":
              if (comment)
                sep += source;
              hasSpace = true;
              break;
            default:
              onError(token, "UNEXPECTED_TOKEN", `Unexpected ${type} at node end`);
          }
          offset += source.length;
        }
      }
      return { comment, offset };
    }
    exports.resolveEnd = resolveEnd;
  }
});

// node_modules/yaml/dist/compose/resolve-flow-collection.js
var require_resolve_flow_collection = __commonJS({
  "node_modules/yaml/dist/compose/resolve-flow-collection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Pair = require_Pair();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    var utilContainsNewline = require_util_contains_newline();
    var utilMapIncludes = require_util_map_includes();
    var blockMsg = "Block collections are not allowed within flow collections";
    var isBlock = (token) => token && (token.type === "block-map" || token.type === "block-seq");
    function resolveFlowCollection({ composeNode, composeEmptyNode }, ctx, fc, onError, tag) {
      const isMap2 = fc.start.source === "{";
      const fcName = isMap2 ? "flow map" : "flow sequence";
      const NodeClass = tag?.nodeClass ?? (isMap2 ? YAMLMap.YAMLMap : YAMLSeq.YAMLSeq);
      const coll = new NodeClass(ctx.schema);
      coll.flow = true;
      const atRoot = ctx.atRoot;
      if (atRoot)
        ctx.atRoot = false;
      if (ctx.atKey)
        ctx.atKey = false;
      let offset = fc.offset + fc.start.source.length;
      for (let i = 0; i < fc.items.length; ++i) {
        const collItem = fc.items[i];
        const { start, key, sep, value } = collItem;
        const props = resolveProps.resolveProps(start, {
          flow: fcName,
          indicator: "explicit-key-ind",
          next: key ?? sep?.[0],
          offset,
          onError,
          parentIndent: fc.indent,
          startOnNewline: false
        });
        if (!props.found) {
          if (!props.anchor && !props.tag && !sep && !value) {
            if (i === 0 && props.comma)
              onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
            else if (i < fc.items.length - 1)
              onError(props.start, "UNEXPECTED_TOKEN", `Unexpected empty item in ${fcName}`);
            if (props.comment) {
              if (coll.comment)
                coll.comment += "\n" + props.comment;
              else
                coll.comment = props.comment;
            }
            offset = props.end;
            continue;
          }
          if (!isMap2 && ctx.options.strict && utilContainsNewline.containsNewline(key))
            onError(
              key,
              // checked by containsNewline()
              "MULTILINE_IMPLICIT_KEY",
              "Implicit keys of flow sequence pairs need to be on a single line"
            );
        }
        if (i === 0) {
          if (props.comma)
            onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
        } else {
          if (!props.comma)
            onError(props.start, "MISSING_CHAR", `Missing , between ${fcName} items`);
          if (props.comment) {
            let prevItemComment = "";
            loop: for (const st of start) {
              switch (st.type) {
                case "comma":
                case "space":
                  break;
                case "comment":
                  prevItemComment = st.source.substring(1);
                  break loop;
                default:
                  break loop;
              }
            }
            if (prevItemComment) {
              let prev = coll.items[coll.items.length - 1];
              if (identity.isPair(prev))
                prev = prev.value ?? prev.key;
              if (prev.comment)
                prev.comment += "\n" + prevItemComment;
              else
                prev.comment = prevItemComment;
              props.comment = props.comment.substring(prevItemComment.length + 1);
            }
          }
        }
        if (!isMap2 && !sep && !props.found) {
          const valueNode = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, sep, null, props, onError);
          coll.items.push(valueNode);
          offset = valueNode.range[2];
          if (isBlock(value))
            onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
        } else {
          ctx.atKey = true;
          const keyStart = props.end;
          const keyNode = key ? composeNode(ctx, key, props, onError) : composeEmptyNode(ctx, keyStart, start, null, props, onError);
          if (isBlock(key))
            onError(keyNode.range, "BLOCK_IN_FLOW", blockMsg);
          ctx.atKey = false;
          const valueProps = resolveProps.resolveProps(sep ?? [], {
            flow: fcName,
            indicator: "map-value-ind",
            next: value,
            offset: keyNode.range[2],
            onError,
            parentIndent: fc.indent,
            startOnNewline: false
          });
          if (valueProps.found) {
            if (!isMap2 && !props.found && ctx.options.strict) {
              if (sep)
                for (const st of sep) {
                  if (st === valueProps.found)
                    break;
                  if (st.type === "newline") {
                    onError(st, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
                    break;
                  }
                }
              if (props.start < valueProps.found.offset - 1024)
                onError(valueProps.found, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit flow sequence key");
            }
          } else if (value) {
            if ("source" in value && value.source?.[0] === ":")
              onError(value, "MISSING_CHAR", `Missing space after : in ${fcName}`);
            else
              onError(valueProps.start, "MISSING_CHAR", `Missing , or : between ${fcName} items`);
          }
          const valueNode = value ? composeNode(ctx, value, valueProps, onError) : valueProps.found ? composeEmptyNode(ctx, valueProps.end, sep, null, valueProps, onError) : null;
          if (valueNode) {
            if (isBlock(value))
              onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
          } else if (valueProps.comment) {
            if (keyNode.comment)
              keyNode.comment += "\n" + valueProps.comment;
            else
              keyNode.comment = valueProps.comment;
          }
          const pair = new Pair.Pair(keyNode, valueNode);
          if (ctx.options.keepSourceTokens)
            pair.srcToken = collItem;
          if (isMap2) {
            const map = coll;
            if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
              onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
            map.items.push(pair);
          } else {
            const map = new YAMLMap.YAMLMap(ctx.schema);
            map.flow = true;
            map.items.push(pair);
            const endRange = (valueNode ?? keyNode).range;
            map.range = [keyNode.range[0], endRange[1], endRange[2]];
            coll.items.push(map);
          }
          offset = valueNode ? valueNode.range[2] : valueProps.end;
        }
      }
      const expectedEnd = isMap2 ? "}" : "]";
      const [ce, ...ee] = fc.end;
      let cePos = offset;
      if (ce?.source === expectedEnd)
        cePos = ce.offset + ce.source.length;
      else {
        const name = fcName[0].toUpperCase() + fcName.substring(1);
        const msg = atRoot ? `${name} must end with a ${expectedEnd}` : `${name} in block collection must be sufficiently indented and end with a ${expectedEnd}`;
        onError(offset, atRoot ? "MISSING_CHAR" : "BAD_INDENT", msg);
        if (ce && ce.source.length !== 1)
          ee.unshift(ce);
      }
      if (ee.length > 0) {
        const end = resolveEnd.resolveEnd(ee, cePos, ctx.options.strict, onError);
        if (end.comment) {
          if (coll.comment)
            coll.comment += "\n" + end.comment;
          else
            coll.comment = end.comment;
        }
        coll.range = [fc.offset, cePos, end.offset];
      } else {
        coll.range = [fc.offset, cePos, cePos];
      }
      return coll;
    }
    exports.resolveFlowCollection = resolveFlowCollection;
  }
});

// node_modules/yaml/dist/compose/compose-collection.js
var require_compose_collection = __commonJS({
  "node_modules/yaml/dist/compose/compose-collection.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar2 = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var resolveBlockMap = require_resolve_block_map();
    var resolveBlockSeq = require_resolve_block_seq();
    var resolveFlowCollection = require_resolve_flow_collection();
    function resolveCollection(CN, ctx, token, onError, tagName, tag) {
      const coll = token.type === "block-map" ? resolveBlockMap.resolveBlockMap(CN, ctx, token, onError, tag) : token.type === "block-seq" ? resolveBlockSeq.resolveBlockSeq(CN, ctx, token, onError, tag) : resolveFlowCollection.resolveFlowCollection(CN, ctx, token, onError, tag);
      const Coll = coll.constructor;
      if (tagName === "!" || tagName === Coll.tagName) {
        coll.tag = Coll.tagName;
        return coll;
      }
      if (tagName)
        coll.tag = tagName;
      return coll;
    }
    function composeCollection(CN, ctx, token, props, onError) {
      const tagToken = props.tag;
      const tagName = !tagToken ? null : ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg));
      if (token.type === "block-seq") {
        const { anchor, newlineAfterProp: nl } = props;
        const lastProp = anchor && tagToken ? anchor.offset > tagToken.offset ? anchor : tagToken : anchor ?? tagToken;
        if (lastProp && (!nl || nl.offset < lastProp.offset)) {
          const message = "Missing newline after block sequence props";
          onError(lastProp, "MISSING_CHAR", message);
        }
      }
      const expType = token.type === "block-map" ? "map" : token.type === "block-seq" ? "seq" : token.start.source === "{" ? "map" : "seq";
      if (!tagToken || !tagName || tagName === "!" || tagName === YAMLMap.YAMLMap.tagName && expType === "map" || tagName === YAMLSeq.YAMLSeq.tagName && expType === "seq") {
        return resolveCollection(CN, ctx, token, onError, tagName);
      }
      let tag = ctx.schema.tags.find((t) => t.tag === tagName && t.collection === expType);
      if (!tag) {
        const kt = ctx.schema.knownTags[tagName];
        if (kt?.collection === expType) {
          ctx.schema.tags.push(Object.assign({}, kt, { default: false }));
          tag = kt;
        } else {
          if (kt) {
            onError(tagToken, "BAD_COLLECTION_TYPE", `${kt.tag} used for ${expType} collection, but expects ${kt.collection ?? "scalar"}`, true);
          } else {
            onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, true);
          }
          return resolveCollection(CN, ctx, token, onError, tagName);
        }
      }
      const coll = resolveCollection(CN, ctx, token, onError, tagName, tag);
      const res = tag.resolve?.(coll, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg), ctx.options) ?? coll;
      const node = identity.isNode(res) ? res : new Scalar2.Scalar(res);
      node.range = coll.range;
      node.tag = tagName;
      if (tag?.format)
        node.format = tag.format;
      return node;
    }
    exports.composeCollection = composeCollection;
  }
});

// node_modules/yaml/dist/compose/resolve-block-scalar.js
var require_resolve_block_scalar = __commonJS({
  "node_modules/yaml/dist/compose/resolve-block-scalar.js"(exports) {
    "use strict";
    var Scalar2 = require_Scalar();
    function resolveBlockScalar(ctx, scalar, onError) {
      const start = scalar.offset;
      const header = parseBlockScalarHeader(scalar, ctx.options.strict, onError);
      if (!header)
        return { value: "", type: null, comment: "", range: [start, start, start] };
      const type = header.mode === ">" ? Scalar2.Scalar.BLOCK_FOLDED : Scalar2.Scalar.BLOCK_LITERAL;
      const lines = scalar.source ? splitLines(scalar.source) : [];
      let chompStart = lines.length;
      for (let i = lines.length - 1; i >= 0; --i) {
        const content = lines[i][1];
        if (content === "" || content === "\r")
          chompStart = i;
        else
          break;
      }
      if (chompStart === 0) {
        const value2 = header.chomp === "+" && lines.length > 0 ? "\n".repeat(Math.max(1, lines.length - 1)) : "";
        let end2 = start + header.length;
        if (scalar.source)
          end2 += scalar.source.length;
        return { value: value2, type, comment: header.comment, range: [start, end2, end2] };
      }
      let trimIndent = scalar.indent + header.indent;
      let offset = scalar.offset + header.length;
      let contentStart = 0;
      for (let i = 0; i < chompStart; ++i) {
        const [indent, content] = lines[i];
        if (content === "" || content === "\r") {
          if (header.indent === 0 && indent.length > trimIndent)
            trimIndent = indent.length;
        } else {
          if (indent.length < trimIndent) {
            const message = "Block scalars with more-indented leading empty lines must use an explicit indentation indicator";
            onError(offset + indent.length, "MISSING_CHAR", message);
          }
          if (header.indent === 0)
            trimIndent = indent.length;
          contentStart = i;
          if (trimIndent === 0 && !ctx.atRoot) {
            const message = "Block scalar values in collections must be indented";
            onError(offset, "BAD_INDENT", message);
          }
          break;
        }
        offset += indent.length + content.length + 1;
      }
      for (let i = lines.length - 1; i >= chompStart; --i) {
        if (lines[i][0].length > trimIndent)
          chompStart = i + 1;
      }
      let value = "";
      let sep = "";
      let prevMoreIndented = false;
      for (let i = 0; i < contentStart; ++i)
        value += lines[i][0].slice(trimIndent) + "\n";
      for (let i = contentStart; i < chompStart; ++i) {
        let [indent, content] = lines[i];
        offset += indent.length + content.length + 1;
        const crlf = content[content.length - 1] === "\r";
        if (crlf)
          content = content.slice(0, -1);
        if (content && indent.length < trimIndent) {
          const src = header.indent ? "explicit indentation indicator" : "first line";
          const message = `Block scalar lines must not be less indented than their ${src}`;
          onError(offset - content.length - (crlf ? 2 : 1), "BAD_INDENT", message);
          indent = "";
        }
        if (type === Scalar2.Scalar.BLOCK_LITERAL) {
          value += sep + indent.slice(trimIndent) + content;
          sep = "\n";
        } else if (indent.length > trimIndent || content[0] === "	") {
          if (sep === " ")
            sep = "\n";
          else if (!prevMoreIndented && sep === "\n")
            sep = "\n\n";
          value += sep + indent.slice(trimIndent) + content;
          sep = "\n";
          prevMoreIndented = true;
        } else if (content === "") {
          if (sep === "\n")
            value += "\n";
          else
            sep = "\n";
        } else {
          value += sep + content;
          sep = " ";
          prevMoreIndented = false;
        }
      }
      switch (header.chomp) {
        case "-":
          break;
        case "+":
          for (let i = chompStart; i < lines.length; ++i)
            value += "\n" + lines[i][0].slice(trimIndent);
          if (value[value.length - 1] !== "\n")
            value += "\n";
          break;
        default:
          value += "\n";
      }
      const end = start + header.length + scalar.source.length;
      return { value, type, comment: header.comment, range: [start, end, end] };
    }
    function parseBlockScalarHeader({ offset, props }, strict, onError) {
      if (props[0].type !== "block-scalar-header") {
        onError(props[0], "IMPOSSIBLE", "Block scalar header not found");
        return null;
      }
      const { source } = props[0];
      const mode = source[0];
      let indent = 0;
      let chomp = "";
      let error = -1;
      for (let i = 1; i < source.length; ++i) {
        const ch = source[i];
        if (!chomp && (ch === "-" || ch === "+"))
          chomp = ch;
        else {
          const n = Number(ch);
          if (!indent && n)
            indent = n;
          else if (error === -1)
            error = offset + i;
        }
      }
      if (error !== -1)
        onError(error, "UNEXPECTED_TOKEN", `Block scalar header includes extra characters: ${source}`);
      let hasSpace = false;
      let comment = "";
      let length = source.length;
      for (let i = 1; i < props.length; ++i) {
        const token = props[i];
        switch (token.type) {
          case "space":
            hasSpace = true;
          // fallthrough
          case "newline":
            length += token.source.length;
            break;
          case "comment":
            if (strict && !hasSpace) {
              const message = "Comments must be separated from other tokens by white space characters";
              onError(token, "MISSING_CHAR", message);
            }
            length += token.source.length;
            comment = token.source.substring(1);
            break;
          case "error":
            onError(token, "UNEXPECTED_TOKEN", token.message);
            length += token.source.length;
            break;
          /* istanbul ignore next should not happen */
          default: {
            const message = `Unexpected token in block scalar header: ${token.type}`;
            onError(token, "UNEXPECTED_TOKEN", message);
            const ts = token.source;
            if (ts && typeof ts === "string")
              length += ts.length;
          }
        }
      }
      return { mode, indent, chomp, comment, length };
    }
    function splitLines(source) {
      const split = source.split(/\n( *)/);
      const first = split[0];
      const m = first.match(/^( *)/);
      const line0 = m?.[1] ? [m[1], first.slice(m[1].length)] : ["", first];
      const lines = [line0];
      for (let i = 1; i < split.length; i += 2)
        lines.push([split[i], split[i + 1]]);
      return lines;
    }
    exports.resolveBlockScalar = resolveBlockScalar;
  }
});

// node_modules/yaml/dist/compose/resolve-flow-scalar.js
var require_resolve_flow_scalar = __commonJS({
  "node_modules/yaml/dist/compose/resolve-flow-scalar.js"(exports) {
    "use strict";
    var Scalar2 = require_Scalar();
    var resolveEnd = require_resolve_end();
    function resolveFlowScalar(scalar, strict, onError) {
      const { offset, type, source, end } = scalar;
      let _type;
      let value;
      const _onError = (rel, code, msg) => onError(offset + rel, code, msg);
      switch (type) {
        case "scalar":
          _type = Scalar2.Scalar.PLAIN;
          value = plainValue(source, _onError);
          break;
        case "single-quoted-scalar":
          _type = Scalar2.Scalar.QUOTE_SINGLE;
          value = singleQuotedValue(source, _onError);
          break;
        case "double-quoted-scalar":
          _type = Scalar2.Scalar.QUOTE_DOUBLE;
          value = doubleQuotedValue(source, _onError);
          break;
        /* istanbul ignore next should not happen */
        default:
          onError(scalar, "UNEXPECTED_TOKEN", `Expected a flow scalar value, but found: ${type}`);
          return {
            value: "",
            type: null,
            comment: "",
            range: [offset, offset + source.length, offset + source.length]
          };
      }
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, strict, onError);
      return {
        value,
        type: _type,
        comment: re.comment,
        range: [offset, valueEnd, re.offset]
      };
    }
    function plainValue(source, onError) {
      let badChar = "";
      switch (source[0]) {
        /* istanbul ignore next should not happen */
        case "	":
          badChar = "a tab character";
          break;
        case ",":
          badChar = "flow indicator character ,";
          break;
        case "%":
          badChar = "directive indicator character %";
          break;
        case "|":
        case ">": {
          badChar = `block scalar indicator ${source[0]}`;
          break;
        }
        case "@":
        case "`": {
          badChar = `reserved character ${source[0]}`;
          break;
        }
      }
      if (badChar)
        onError(0, "BAD_SCALAR_START", `Plain value cannot start with ${badChar}`);
      return foldLines(source);
    }
    function singleQuotedValue(source, onError) {
      if (source[source.length - 1] !== "'" || source.length === 1)
        onError(source.length, "MISSING_CHAR", "Missing closing 'quote");
      return foldLines(source.slice(1, -1)).replace(/''/g, "'");
    }
    function foldLines(source) {
      let first, line;
      try {
        first = new RegExp("(.*?)(?<![ 	])[ 	]*\r?\n", "sy");
        line = new RegExp("[ 	]*(.*?)(?:(?<![ 	])[ 	]*)?\r?\n", "sy");
      } catch {
        first = /(.*?)[ \t]*\r?\n/sy;
        line = /[ \t]*(.*?)[ \t]*\r?\n/sy;
      }
      let match = first.exec(source);
      if (!match)
        return source;
      let res = match[1];
      let sep = " ";
      let pos = first.lastIndex;
      line.lastIndex = pos;
      while (match = line.exec(source)) {
        if (match[1] === "") {
          if (sep === "\n")
            res += sep;
          else
            sep = "\n";
        } else {
          res += sep + match[1];
          sep = " ";
        }
        pos = line.lastIndex;
      }
      const last = /[ \t]*(.*)/sy;
      last.lastIndex = pos;
      match = last.exec(source);
      return res + sep + (match?.[1] ?? "");
    }
    function doubleQuotedValue(source, onError) {
      let res = "";
      for (let i = 1; i < source.length - 1; ++i) {
        const ch = source[i];
        if (ch === "\r" && source[i + 1] === "\n")
          continue;
        if (ch === "\n") {
          const { fold, offset } = foldNewline(source, i);
          res += fold;
          i = offset;
        } else if (ch === "\\") {
          let next = source[++i];
          const cc = escapeCodes[next];
          if (cc)
            res += cc;
          else if (next === "\n") {
            next = source[i + 1];
            while (next === " " || next === "	")
              next = source[++i + 1];
          } else if (next === "\r" && source[i + 1] === "\n") {
            next = source[++i + 1];
            while (next === " " || next === "	")
              next = source[++i + 1];
          } else if (next === "x" || next === "u" || next === "U") {
            const length = next === "x" ? 2 : next === "u" ? 4 : 8;
            res += parseCharCode(source, i + 1, length, onError);
            i += length;
          } else {
            const raw = source.substr(i - 1, 2);
            onError(i - 1, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
            res += raw;
          }
        } else if (ch === " " || ch === "	") {
          const wsStart = i;
          let next = source[i + 1];
          while (next === " " || next === "	")
            next = source[++i + 1];
          if (next !== "\n" && !(next === "\r" && source[i + 2] === "\n"))
            res += i > wsStart ? source.slice(wsStart, i + 1) : ch;
        } else {
          res += ch;
        }
      }
      if (source[source.length - 1] !== '"' || source.length === 1)
        onError(source.length, "MISSING_CHAR", 'Missing closing "quote');
      return res;
    }
    function foldNewline(source, offset) {
      let fold = "";
      let ch = source[offset + 1];
      while (ch === " " || ch === "	" || ch === "\n" || ch === "\r") {
        if (ch === "\r" && source[offset + 2] !== "\n")
          break;
        if (ch === "\n")
          fold += "\n";
        offset += 1;
        ch = source[offset + 1];
      }
      if (!fold)
        fold = " ";
      return { fold, offset };
    }
    var escapeCodes = {
      "0": "\0",
      // null character
      a: "\x07",
      // bell character
      b: "\b",
      // backspace
      e: "\x1B",
      // escape character
      f: "\f",
      // form feed
      n: "\n",
      // line feed
      r: "\r",
      // carriage return
      t: "	",
      // horizontal tab
      v: "\v",
      // vertical tab
      N: "\x85",
      // Unicode next line
      _: "\xA0",
      // Unicode non-breaking space
      L: "\u2028",
      // Unicode line separator
      P: "\u2029",
      // Unicode paragraph separator
      " ": " ",
      '"': '"',
      "/": "/",
      "\\": "\\",
      "	": "	"
    };
    function parseCharCode(source, offset, length, onError) {
      const cc = source.substr(offset, length);
      const ok = cc.length === length && /^[0-9a-fA-F]+$/.test(cc);
      const code = ok ? parseInt(cc, 16) : NaN;
      try {
        return String.fromCodePoint(code);
      } catch {
        const raw = source.substr(offset - 2, length + 2);
        onError(offset - 2, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
        return raw;
      }
    }
    exports.resolveFlowScalar = resolveFlowScalar;
  }
});

// node_modules/yaml/dist/compose/compose-scalar.js
var require_compose_scalar = __commonJS({
  "node_modules/yaml/dist/compose/compose-scalar.js"(exports) {
    "use strict";
    var identity = require_identity();
    var Scalar2 = require_Scalar();
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    function composeScalar(ctx, token, tagToken, onError) {
      const { value, type, comment, range } = token.type === "block-scalar" ? resolveBlockScalar.resolveBlockScalar(ctx, token, onError) : resolveFlowScalar.resolveFlowScalar(token, ctx.options.strict, onError);
      const tagName = tagToken ? ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg)) : null;
      let tag;
      if (ctx.options.stringKeys && ctx.atKey) {
        tag = ctx.schema[identity.SCALAR];
      } else if (tagName)
        tag = findScalarTagByName(ctx.schema, value, tagName, tagToken, onError);
      else if (token.type === "scalar")
        tag = findScalarTagByTest(ctx, value, token, onError);
      else
        tag = ctx.schema[identity.SCALAR];
      let scalar;
      try {
        const res = tag.resolve(value, (msg) => onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg), ctx.options);
        scalar = identity.isScalar(res) ? res : new Scalar2.Scalar(res);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg);
        scalar = new Scalar2.Scalar(value);
      }
      scalar.range = range;
      scalar.source = value;
      if (type)
        scalar.type = type;
      if (tagName)
        scalar.tag = tagName;
      if (tag.format)
        scalar.format = tag.format;
      if (comment)
        scalar.comment = comment;
      return scalar;
    }
    function findScalarTagByName(schema, value, tagName, tagToken, onError) {
      if (tagName === "!")
        return schema[identity.SCALAR];
      const matchWithTest = [];
      for (const tag of schema.tags) {
        if (!tag.collection && tag.tag === tagName) {
          if (tag.default && tag.test)
            matchWithTest.push(tag);
          else
            return tag;
        }
      }
      for (const tag of matchWithTest)
        if (tag.test?.test(value))
          return tag;
      const kt = schema.knownTags[tagName];
      if (kt && !kt.collection) {
        schema.tags.push(Object.assign({}, kt, { default: false, test: void 0 }));
        return kt;
      }
      onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, tagName !== "tag:yaml.org,2002:str");
      return schema[identity.SCALAR];
    }
    function findScalarTagByTest({ atKey, directives, schema }, value, token, onError) {
      const tag = schema.tags.find((tag2) => (tag2.default === true || atKey && tag2.default === "key") && tag2.test?.test(value)) || schema[identity.SCALAR];
      if (schema.compat) {
        const compat = schema.compat.find((tag2) => tag2.default && tag2.test?.test(value)) ?? schema[identity.SCALAR];
        if (tag.tag !== compat.tag) {
          const ts = directives.tagString(tag.tag);
          const cs = directives.tagString(compat.tag);
          const msg = `Value may be parsed as either ${ts} or ${cs}`;
          onError(token, "TAG_RESOLVE_FAILED", msg, true);
        }
      }
      return tag;
    }
    exports.composeScalar = composeScalar;
  }
});

// node_modules/yaml/dist/compose/util-empty-scalar-position.js
var require_util_empty_scalar_position = __commonJS({
  "node_modules/yaml/dist/compose/util-empty-scalar-position.js"(exports) {
    "use strict";
    function emptyScalarPosition(offset, before, pos) {
      if (before) {
        pos ?? (pos = before.length);
        for (let i = pos - 1; i >= 0; --i) {
          let st = before[i];
          switch (st.type) {
            case "space":
            case "comment":
            case "newline":
              offset -= st.source.length;
              continue;
          }
          st = before[++i];
          while (st?.type === "space") {
            offset += st.source.length;
            st = before[++i];
          }
          break;
        }
      }
      return offset;
    }
    exports.emptyScalarPosition = emptyScalarPosition;
  }
});

// node_modules/yaml/dist/compose/compose-node.js
var require_compose_node = __commonJS({
  "node_modules/yaml/dist/compose/compose-node.js"(exports) {
    "use strict";
    var Alias = require_Alias();
    var identity = require_identity();
    var composeCollection = require_compose_collection();
    var composeScalar = require_compose_scalar();
    var resolveEnd = require_resolve_end();
    var utilEmptyScalarPosition = require_util_empty_scalar_position();
    var CN = { composeNode, composeEmptyNode };
    function composeNode(ctx, token, props, onError) {
      const atKey = ctx.atKey;
      const { spaceBefore, comment, anchor, tag } = props;
      let node;
      let isSrcToken = true;
      switch (token.type) {
        case "alias":
          node = composeAlias(ctx, token, onError);
          if (anchor || tag)
            onError(token, "ALIAS_PROPS", "An alias node must not specify any properties");
          break;
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "block-scalar":
          node = composeScalar.composeScalar(ctx, token, tag, onError);
          if (anchor)
            node.anchor = anchor.source.substring(1);
          break;
        case "block-map":
        case "block-seq":
        case "flow-collection":
          try {
            node = composeCollection.composeCollection(CN, ctx, token, props, onError);
            if (anchor)
              node.anchor = anchor.source.substring(1);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            onError(token, "RESOURCE_EXHAUSTION", message);
          }
          break;
        default: {
          const message = token.type === "error" ? token.message : `Unsupported token (type: ${token.type})`;
          onError(token, "UNEXPECTED_TOKEN", message);
          isSrcToken = false;
        }
      }
      node ?? (node = composeEmptyNode(ctx, token.offset, void 0, null, props, onError));
      if (anchor && node.anchor === "")
        onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      if (atKey && ctx.options.stringKeys && (!identity.isScalar(node) || typeof node.value !== "string" || node.tag && node.tag !== "tag:yaml.org,2002:str")) {
        const msg = "With stringKeys, all keys must be strings";
        onError(tag ?? token, "NON_STRING_KEY", msg);
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment) {
        if (token.type === "scalar" && token.source === "")
          node.comment = comment;
        else
          node.commentBefore = comment;
      }
      if (ctx.options.keepSourceTokens && isSrcToken)
        node.srcToken = token;
      return node;
    }
    function composeEmptyNode(ctx, offset, before, pos, { spaceBefore, comment, anchor, tag, end }, onError) {
      const token = {
        type: "scalar",
        offset: utilEmptyScalarPosition.emptyScalarPosition(offset, before, pos),
        indent: -1,
        source: ""
      };
      const node = composeScalar.composeScalar(ctx, token, tag, onError);
      if (anchor) {
        node.anchor = anchor.source.substring(1);
        if (node.anchor === "")
          onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
      }
      if (spaceBefore)
        node.spaceBefore = true;
      if (comment) {
        node.comment = comment;
        node.range[2] = end;
      }
      return node;
    }
    function composeAlias({ options }, { offset, source, end }, onError) {
      const alias = new Alias.Alias(source.substring(1));
      if (alias.source === "")
        onError(offset, "BAD_ALIAS", "Alias cannot be an empty string");
      if (alias.source.endsWith(":"))
        onError(offset + source.length - 1, "BAD_ALIAS", "Alias ending in : is ambiguous", true);
      const valueEnd = offset + source.length;
      const re = resolveEnd.resolveEnd(end, valueEnd, options.strict, onError);
      alias.range = [offset, valueEnd, re.offset];
      if (re.comment)
        alias.comment = re.comment;
      return alias;
    }
    exports.composeEmptyNode = composeEmptyNode;
    exports.composeNode = composeNode;
  }
});

// node_modules/yaml/dist/compose/compose-doc.js
var require_compose_doc = __commonJS({
  "node_modules/yaml/dist/compose/compose-doc.js"(exports) {
    "use strict";
    var Document = require_Document();
    var composeNode = require_compose_node();
    var resolveEnd = require_resolve_end();
    var resolveProps = require_resolve_props();
    function composeDoc(options, directives, { offset, start, value, end }, onError) {
      const opts = Object.assign({ _directives: directives }, options);
      const doc = new Document.Document(void 0, opts);
      const ctx = {
        atKey: false,
        atRoot: true,
        directives: doc.directives,
        options: doc.options,
        schema: doc.schema
      };
      const props = resolveProps.resolveProps(start, {
        indicator: "doc-start",
        next: value ?? end?.[0],
        offset,
        onError,
        parentIndent: 0,
        startOnNewline: true
      });
      if (props.found) {
        doc.directives.docStart = true;
        if (value && (value.type === "block-map" || value.type === "block-seq") && !props.hasNewline)
          onError(props.end, "MISSING_CHAR", "Block collection cannot start on same line with directives-end marker");
      }
      doc.contents = value ? composeNode.composeNode(ctx, value, props, onError) : composeNode.composeEmptyNode(ctx, props.end, start, null, props, onError);
      const contentEnd = doc.contents.range[2];
      const re = resolveEnd.resolveEnd(end, contentEnd, false, onError);
      if (re.comment)
        doc.comment = re.comment;
      doc.range = [offset, contentEnd, re.offset];
      return doc;
    }
    exports.composeDoc = composeDoc;
  }
});

// node_modules/yaml/dist/compose/composer.js
var require_composer = __commonJS({
  "node_modules/yaml/dist/compose/composer.js"(exports) {
    "use strict";
    var node_process = __require("process");
    var directives = require_directives();
    var Document = require_Document();
    var errors = require_errors();
    var identity = require_identity();
    var composeDoc = require_compose_doc();
    var resolveEnd = require_resolve_end();
    function getErrorPos(src) {
      if (typeof src === "number")
        return [src, src + 1];
      if (Array.isArray(src))
        return src.length === 2 ? src : [src[0], src[1]];
      const { offset, source } = src;
      return [offset, offset + (typeof source === "string" ? source.length : 1)];
    }
    function parsePrelude(prelude) {
      let comment = "";
      let atComment = false;
      let afterEmptyLine = false;
      for (let i = 0; i < prelude.length; ++i) {
        const source = prelude[i];
        switch (source[0]) {
          case "#":
            comment += (comment === "" ? "" : afterEmptyLine ? "\n\n" : "\n") + (source.substring(1) || " ");
            atComment = true;
            afterEmptyLine = false;
            break;
          case "%":
            if (prelude[i + 1]?.[0] !== "#")
              i += 1;
            atComment = false;
            break;
          default:
            if (!atComment)
              afterEmptyLine = true;
            atComment = false;
        }
      }
      return { comment, afterEmptyLine };
    }
    var Composer = class {
      constructor(options = {}) {
        this.doc = null;
        this.atDirectives = false;
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
        this.onError = (source, code, message, warning) => {
          const pos = getErrorPos(source);
          if (warning)
            this.warnings.push(new errors.YAMLWarning(pos, code, message));
          else
            this.errors.push(new errors.YAMLParseError(pos, code, message));
        };
        this.directives = new directives.Directives({ version: options.version || "1.2" });
        this.options = options;
      }
      decorate(doc, afterDoc) {
        const { comment, afterEmptyLine } = parsePrelude(this.prelude);
        if (comment) {
          const dc = doc.contents;
          if (afterDoc) {
            doc.comment = doc.comment ? `${doc.comment}
${comment}` : comment;
          } else if (afterEmptyLine || doc.directives.docStart || !dc) {
            doc.commentBefore = comment;
          } else if (identity.isCollection(dc) && !dc.flow && dc.items.length > 0) {
            let it = dc.items[0];
            if (identity.isPair(it))
              it = it.key;
            const cb = it.commentBefore;
            it.commentBefore = cb ? `${comment}
${cb}` : comment;
          } else {
            const cb = dc.commentBefore;
            dc.commentBefore = cb ? `${comment}
${cb}` : comment;
          }
        }
        if (afterDoc) {
          for (let i = 0; i < this.errors.length; ++i)
            doc.errors.push(this.errors[i]);
          for (let i = 0; i < this.warnings.length; ++i)
            doc.warnings.push(this.warnings[i]);
        } else {
          doc.errors = this.errors;
          doc.warnings = this.warnings;
        }
        this.prelude = [];
        this.errors = [];
        this.warnings = [];
      }
      /**
       * Current stream status information.
       *
       * Mostly useful at the end of input for an empty stream.
       */
      streamInfo() {
        return {
          comment: parsePrelude(this.prelude).comment,
          directives: this.directives,
          errors: this.errors,
          warnings: this.warnings
        };
      }
      /**
       * Compose tokens into documents.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *compose(tokens, forceDoc = false, endOffset = -1) {
        for (const token of tokens)
          yield* this.next(token);
        yield* this.end(forceDoc, endOffset);
      }
      /** Advance the composer by one CST token. */
      *next(token) {
        if (node_process.env.LOG_STREAM)
          console.dir(token, { depth: null });
        switch (token.type) {
          case "directive":
            this.directives.add(token.source, (offset, message, warning) => {
              const pos = getErrorPos(token);
              pos[0] += offset;
              this.onError(pos, "BAD_DIRECTIVE", message, warning);
            });
            this.prelude.push(token.source);
            this.atDirectives = true;
            break;
          case "document": {
            const doc = composeDoc.composeDoc(this.options, this.directives, token, this.onError);
            if (this.atDirectives && !doc.directives.docStart)
              this.onError(token, "MISSING_CHAR", "Missing directives-end/doc-start indicator line");
            this.decorate(doc, false);
            if (this.doc)
              yield this.doc;
            this.doc = doc;
            this.atDirectives = false;
            break;
          }
          case "byte-order-mark":
          case "space":
            break;
          case "comment":
          case "newline":
            this.prelude.push(token.source);
            break;
          case "error": {
            const msg = token.source ? `${token.message}: ${JSON.stringify(token.source)}` : token.message;
            const error = new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg);
            if (this.atDirectives || !this.doc)
              this.errors.push(error);
            else
              this.doc.errors.push(error);
            break;
          }
          case "doc-end": {
            if (!this.doc) {
              const msg = "Unexpected doc-end without preceding document";
              this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg));
              break;
            }
            this.doc.directives.docEnd = true;
            const end = resolveEnd.resolveEnd(token.end, token.offset + token.source.length, this.doc.options.strict, this.onError);
            this.decorate(this.doc, true);
            if (end.comment) {
              const dc = this.doc.comment;
              this.doc.comment = dc ? `${dc}
${end.comment}` : end.comment;
            }
            this.doc.range[2] = end.offset;
            break;
          }
          default:
            this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", `Unsupported token ${token.type}`));
        }
      }
      /**
       * Call at end of input to yield any remaining document.
       *
       * @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
       * @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
       */
      *end(forceDoc = false, endOffset = -1) {
        if (this.doc) {
          this.decorate(this.doc, true);
          yield this.doc;
          this.doc = null;
        } else if (forceDoc) {
          const opts = Object.assign({ _directives: this.directives }, this.options);
          const doc = new Document.Document(void 0, opts);
          if (this.atDirectives)
            this.onError(endOffset, "MISSING_CHAR", "Missing directives-end indicator line");
          doc.range = [0, endOffset, endOffset];
          this.decorate(doc, false);
          yield doc;
        }
      }
    };
    exports.Composer = Composer;
  }
});

// node_modules/yaml/dist/parse/cst-scalar.js
var require_cst_scalar = __commonJS({
  "node_modules/yaml/dist/parse/cst-scalar.js"(exports) {
    "use strict";
    var resolveBlockScalar = require_resolve_block_scalar();
    var resolveFlowScalar = require_resolve_flow_scalar();
    var errors = require_errors();
    var stringifyString = require_stringifyString();
    function resolveAsScalar(token, strict = true, onError) {
      if (token) {
        const _onError = (pos, code, message) => {
          const offset = typeof pos === "number" ? pos : Array.isArray(pos) ? pos[0] : pos.offset;
          if (onError)
            onError(offset, code, message);
          else
            throw new errors.YAMLParseError([offset, offset + 1], code, message);
        };
        switch (token.type) {
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return resolveFlowScalar.resolveFlowScalar(token, strict, _onError);
          case "block-scalar":
            return resolveBlockScalar.resolveBlockScalar({ options: { strict } }, token, _onError);
        }
      }
      return null;
    }
    function createScalarToken(value, context) {
      const { implicitKey = false, indent, inFlow = false, offset = -1, type = "PLAIN" } = context;
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey,
        indent: indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      const end = context.end ?? [
        { type: "newline", offset: -1, indent, source: "\n" }
      ];
      switch (source[0]) {
        case "|":
        case ">": {
          const he = source.indexOf("\n");
          const head = source.substring(0, he);
          const body = source.substring(he + 1) + "\n";
          const props = [
            { type: "block-scalar-header", offset, indent, source: head }
          ];
          if (!addEndtoBlockProps(props, end))
            props.push({ type: "newline", offset: -1, indent, source: "\n" });
          return { type: "block-scalar", offset, indent, props, source: body };
        }
        case '"':
          return { type: "double-quoted-scalar", offset, indent, source, end };
        case "'":
          return { type: "single-quoted-scalar", offset, indent, source, end };
        default:
          return { type: "scalar", offset, indent, source, end };
      }
    }
    function setScalarValue(token, value, context = {}) {
      let { afterKey = false, implicitKey = false, inFlow = false, type } = context;
      let indent = "indent" in token ? token.indent : null;
      if (afterKey && typeof indent === "number")
        indent += 2;
      if (!type)
        switch (token.type) {
          case "single-quoted-scalar":
            type = "QUOTE_SINGLE";
            break;
          case "double-quoted-scalar":
            type = "QUOTE_DOUBLE";
            break;
          case "block-scalar": {
            const header = token.props[0];
            if (header.type !== "block-scalar-header")
              throw new Error("Invalid block scalar header");
            type = header.source[0] === ">" ? "BLOCK_FOLDED" : "BLOCK_LITERAL";
            break;
          }
          default:
            type = "PLAIN";
        }
      const source = stringifyString.stringifyString({ type, value }, {
        implicitKey: implicitKey || indent === null,
        indent: indent !== null && indent > 0 ? " ".repeat(indent) : "",
        inFlow,
        options: { blockQuote: true, lineWidth: -1 }
      });
      switch (source[0]) {
        case "|":
        case ">":
          setBlockScalarValue(token, source);
          break;
        case '"':
          setFlowScalarValue(token, source, "double-quoted-scalar");
          break;
        case "'":
          setFlowScalarValue(token, source, "single-quoted-scalar");
          break;
        default:
          setFlowScalarValue(token, source, "scalar");
      }
    }
    function setBlockScalarValue(token, source) {
      const he = source.indexOf("\n");
      const head = source.substring(0, he);
      const body = source.substring(he + 1) + "\n";
      if (token.type === "block-scalar") {
        const header = token.props[0];
        if (header.type !== "block-scalar-header")
          throw new Error("Invalid block scalar header");
        header.source = head;
        token.source = body;
      } else {
        const { offset } = token;
        const indent = "indent" in token ? token.indent : -1;
        const props = [
          { type: "block-scalar-header", offset, indent, source: head }
        ];
        if (!addEndtoBlockProps(props, "end" in token ? token.end : void 0))
          props.push({ type: "newline", offset: -1, indent, source: "\n" });
        for (const key of Object.keys(token))
          if (key !== "type" && key !== "offset")
            delete token[key];
        Object.assign(token, { type: "block-scalar", indent, props, source: body });
      }
    }
    function addEndtoBlockProps(props, end) {
      if (end)
        for (const st of end)
          switch (st.type) {
            case "space":
            case "comment":
              props.push(st);
              break;
            case "newline":
              props.push(st);
              return true;
          }
      return false;
    }
    function setFlowScalarValue(token, source, type) {
      switch (token.type) {
        case "scalar":
        case "double-quoted-scalar":
        case "single-quoted-scalar":
          token.type = type;
          token.source = source;
          break;
        case "block-scalar": {
          const end = token.props.slice(1);
          let oa = source.length;
          if (token.props[0].type === "block-scalar-header")
            oa -= token.props[0].source.length;
          for (const tok of end)
            tok.offset += oa;
          delete token.props;
          Object.assign(token, { type, source, end });
          break;
        }
        case "block-map":
        case "block-seq": {
          const offset = token.offset + source.length;
          const nl = { type: "newline", offset, indent: token.indent, source: "\n" };
          delete token.items;
          Object.assign(token, { type, source, end: [nl] });
          break;
        }
        default: {
          const indent = "indent" in token ? token.indent : -1;
          const end = "end" in token && Array.isArray(token.end) ? token.end.filter((st) => st.type === "space" || st.type === "comment" || st.type === "newline") : [];
          for (const key of Object.keys(token))
            if (key !== "type" && key !== "offset")
              delete token[key];
          Object.assign(token, { type, indent, source, end });
        }
      }
    }
    exports.createScalarToken = createScalarToken;
    exports.resolveAsScalar = resolveAsScalar;
    exports.setScalarValue = setScalarValue;
  }
});

// node_modules/yaml/dist/parse/cst-stringify.js
var require_cst_stringify = __commonJS({
  "node_modules/yaml/dist/parse/cst-stringify.js"(exports) {
    "use strict";
    var stringify = (cst) => "type" in cst ? stringifyToken(cst) : stringifyItem(cst);
    function stringifyToken(token) {
      switch (token.type) {
        case "block-scalar": {
          let res = "";
          for (const tok of token.props)
            res += stringifyToken(tok);
          return res + token.source;
        }
        case "block-map":
        case "block-seq": {
          let res = "";
          for (const item of token.items)
            res += stringifyItem(item);
          return res;
        }
        case "flow-collection": {
          let res = token.start.source;
          for (const item of token.items)
            res += stringifyItem(item);
          for (const st of token.end)
            res += st.source;
          return res;
        }
        case "document": {
          let res = stringifyItem(token);
          if (token.end)
            for (const st of token.end)
              res += st.source;
          return res;
        }
        default: {
          let res = token.source;
          if ("end" in token && token.end)
            for (const st of token.end)
              res += st.source;
          return res;
        }
      }
    }
    function stringifyItem({ start, key, sep, value }) {
      let res = "";
      for (const st of start)
        res += st.source;
      if (key)
        res += stringifyToken(key);
      if (sep)
        for (const st of sep)
          res += st.source;
      if (value)
        res += stringifyToken(value);
      return res;
    }
    exports.stringify = stringify;
  }
});

// node_modules/yaml/dist/parse/cst-visit.js
var require_cst_visit = __commonJS({
  "node_modules/yaml/dist/parse/cst-visit.js"(exports) {
    "use strict";
    var BREAK = Symbol("break visit");
    var SKIP = Symbol("skip children");
    var REMOVE = Symbol("remove item");
    function visit(cst, visitor) {
      if ("type" in cst && cst.type === "document")
        cst = { start: cst.start, value: cst.value };
      _visit(Object.freeze([]), cst, visitor);
    }
    visit.BREAK = BREAK;
    visit.SKIP = SKIP;
    visit.REMOVE = REMOVE;
    visit.itemAtPath = (cst, path) => {
      let item = cst;
      for (const [field, index] of path) {
        const tok = item?.[field];
        if (tok && "items" in tok) {
          item = tok.items[index];
        } else
          return void 0;
      }
      return item;
    };
    visit.parentCollection = (cst, path) => {
      const parent = visit.itemAtPath(cst, path.slice(0, -1));
      const field = path[path.length - 1][0];
      const coll = parent?.[field];
      if (coll && "items" in coll)
        return coll;
      throw new Error("Parent collection not found");
    };
    function _visit(path, item, visitor) {
      let ctrl = visitor(item, path);
      if (typeof ctrl === "symbol")
        return ctrl;
      for (const field of ["key", "value"]) {
        const token = item[field];
        if (token && "items" in token) {
          for (let i = 0; i < token.items.length; ++i) {
            const ci = _visit(Object.freeze(path.concat([[field, i]])), token.items[i], visitor);
            if (typeof ci === "number")
              i = ci - 1;
            else if (ci === BREAK)
              return BREAK;
            else if (ci === REMOVE) {
              token.items.splice(i, 1);
              i -= 1;
            }
          }
          if (typeof ctrl === "function" && field === "key")
            ctrl = ctrl(item, path);
        }
      }
      return typeof ctrl === "function" ? ctrl(item, path) : ctrl;
    }
    exports.visit = visit;
  }
});

// node_modules/yaml/dist/parse/cst.js
var require_cst = __commonJS({
  "node_modules/yaml/dist/parse/cst.js"(exports) {
    "use strict";
    var cstScalar = require_cst_scalar();
    var cstStringify = require_cst_stringify();
    var cstVisit = require_cst_visit();
    var BOM = "\uFEFF";
    var DOCUMENT = "";
    var FLOW_END = "";
    var SCALAR = "";
    var isCollection = (token) => !!token && "items" in token;
    var isScalar2 = (token) => !!token && (token.type === "scalar" || token.type === "single-quoted-scalar" || token.type === "double-quoted-scalar" || token.type === "block-scalar");
    function prettyToken(token) {
      switch (token) {
        case BOM:
          return "<BOM>";
        case DOCUMENT:
          return "<DOC>";
        case FLOW_END:
          return "<FLOW_END>";
        case SCALAR:
          return "<SCALAR>";
        default:
          return JSON.stringify(token);
      }
    }
    function tokenType(source) {
      switch (source) {
        case BOM:
          return "byte-order-mark";
        case DOCUMENT:
          return "doc-mode";
        case FLOW_END:
          return "flow-error-end";
        case SCALAR:
          return "scalar";
        case "---":
          return "doc-start";
        case "...":
          return "doc-end";
        case "":
        case "\n":
        case "\r\n":
          return "newline";
        case "-":
          return "seq-item-ind";
        case "?":
          return "explicit-key-ind";
        case ":":
          return "map-value-ind";
        case "{":
          return "flow-map-start";
        case "}":
          return "flow-map-end";
        case "[":
          return "flow-seq-start";
        case "]":
          return "flow-seq-end";
        case ",":
          return "comma";
      }
      switch (source[0]) {
        case " ":
        case "	":
          return "space";
        case "#":
          return "comment";
        case "%":
          return "directive-line";
        case "*":
          return "alias";
        case "&":
          return "anchor";
        case "!":
          return "tag";
        case "'":
          return "single-quoted-scalar";
        case '"':
          return "double-quoted-scalar";
        case "|":
        case ">":
          return "block-scalar-header";
      }
      return null;
    }
    exports.createScalarToken = cstScalar.createScalarToken;
    exports.resolveAsScalar = cstScalar.resolveAsScalar;
    exports.setScalarValue = cstScalar.setScalarValue;
    exports.stringify = cstStringify.stringify;
    exports.visit = cstVisit.visit;
    exports.BOM = BOM;
    exports.DOCUMENT = DOCUMENT;
    exports.FLOW_END = FLOW_END;
    exports.SCALAR = SCALAR;
    exports.isCollection = isCollection;
    exports.isScalar = isScalar2;
    exports.prettyToken = prettyToken;
    exports.tokenType = tokenType;
  }
});

// node_modules/yaml/dist/parse/lexer.js
var require_lexer = __commonJS({
  "node_modules/yaml/dist/parse/lexer.js"(exports) {
    "use strict";
    var cst = require_cst();
    function isEmpty(ch) {
      switch (ch) {
        case void 0:
        case " ":
        case "\n":
        case "\r":
        case "	":
          return true;
        default:
          return false;
      }
    }
    var hexDigits = new Set("0123456789ABCDEFabcdef");
    var tagChars = new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()");
    var flowIndicatorChars = new Set(",[]{}");
    var invalidAnchorChars = new Set(" ,[]{}\n\r	");
    var isNotAnchorChar = (ch) => !ch || invalidAnchorChars.has(ch);
    var Lexer = class {
      constructor() {
        this.atEnd = false;
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        this.buffer = "";
        this.flowKey = false;
        this.flowLevel = 0;
        this.indentNext = 0;
        this.indentValue = 0;
        this.lineEndPos = null;
        this.next = null;
        this.pos = 0;
      }
      /**
       * Generate YAML tokens from the `source` string. If `incomplete`,
       * a part of the last line may be left as a buffer for the next call.
       *
       * @returns A generator of lexical tokens
       */
      *lex(source, incomplete = false) {
        if (source) {
          if (typeof source !== "string")
            throw TypeError("source is not a string");
          this.buffer = this.buffer ? this.buffer + source : source;
          this.lineEndPos = null;
        }
        this.atEnd = !incomplete;
        let next = this.next ?? "stream";
        while (next && (incomplete || this.hasChars(1)))
          next = yield* this.parseNext(next);
      }
      atLineEnd() {
        let i = this.pos;
        let ch = this.buffer[i];
        while (ch === " " || ch === "	")
          ch = this.buffer[++i];
        if (!ch || ch === "#" || ch === "\n")
          return true;
        if (ch === "\r")
          return this.buffer[i + 1] === "\n";
        return false;
      }
      charAt(n) {
        return this.buffer[this.pos + n];
      }
      continueScalar(offset) {
        let ch = this.buffer[offset];
        if (this.indentNext > 0) {
          let indent = 0;
          while (ch === " ")
            ch = this.buffer[++indent + offset];
          if (ch === "\r") {
            const next = this.buffer[indent + offset + 1];
            if (next === "\n" || !next && !this.atEnd)
              return offset + indent + 1;
          }
          return ch === "\n" || indent >= this.indentNext || !ch && !this.atEnd ? offset + indent : -1;
        }
        if (ch === "-" || ch === ".") {
          const dt = this.buffer.substr(offset, 3);
          if ((dt === "---" || dt === "...") && isEmpty(this.buffer[offset + 3]))
            return -1;
        }
        return offset;
      }
      getLine() {
        let end = this.lineEndPos;
        if (typeof end !== "number" || end !== -1 && end < this.pos) {
          end = this.buffer.indexOf("\n", this.pos);
          this.lineEndPos = end;
        }
        if (end === -1)
          return this.atEnd ? this.buffer.substring(this.pos) : null;
        if (this.buffer[end - 1] === "\r")
          end -= 1;
        return this.buffer.substring(this.pos, end);
      }
      hasChars(n) {
        return this.pos + n <= this.buffer.length;
      }
      setNext(state) {
        this.buffer = this.buffer.substring(this.pos);
        this.pos = 0;
        this.lineEndPos = null;
        this.next = state;
        return null;
      }
      peek(n) {
        return this.buffer.substr(this.pos, n);
      }
      *parseNext(next) {
        switch (next) {
          case "stream":
            return yield* this.parseStream();
          case "line-start":
            return yield* this.parseLineStart();
          case "block-start":
            return yield* this.parseBlockStart();
          case "doc":
            return yield* this.parseDocument();
          case "flow":
            return yield* this.parseFlowCollection();
          case "quoted-scalar":
            return yield* this.parseQuotedScalar();
          case "block-scalar":
            return yield* this.parseBlockScalar();
          case "plain-scalar":
            return yield* this.parsePlainScalar();
        }
      }
      *parseStream() {
        let line = this.getLine();
        if (line === null)
          return this.setNext("stream");
        if (line[0] === cst.BOM) {
          yield* this.pushCount(1);
          line = line.substring(1);
        }
        if (line[0] === "%") {
          let dirEnd = line.length;
          let cs = line.indexOf("#");
          while (cs !== -1) {
            const ch = line[cs - 1];
            if (ch === " " || ch === "	") {
              dirEnd = cs - 1;
              break;
            } else {
              cs = line.indexOf("#", cs + 1);
            }
          }
          while (true) {
            const ch = line[dirEnd - 1];
            if (ch === " " || ch === "	")
              dirEnd -= 1;
            else
              break;
          }
          const n = (yield* this.pushCount(dirEnd)) + (yield* this.pushSpaces(true));
          yield* this.pushCount(line.length - n);
          this.pushNewline();
          return "stream";
        }
        if (this.atLineEnd()) {
          const sp = yield* this.pushSpaces(true);
          yield* this.pushCount(line.length - sp);
          yield* this.pushNewline();
          return "stream";
        }
        yield cst.DOCUMENT;
        return yield* this.parseLineStart();
      }
      *parseLineStart() {
        const ch = this.charAt(0);
        if (!ch && !this.atEnd)
          return this.setNext("line-start");
        if (ch === "-" || ch === ".") {
          if (!this.atEnd && !this.hasChars(4))
            return this.setNext("line-start");
          const s = this.peek(3);
          if ((s === "---" || s === "...") && isEmpty(this.charAt(3))) {
            yield* this.pushCount(3);
            this.indentValue = 0;
            this.indentNext = 0;
            return s === "---" ? "doc" : "stream";
          }
        }
        this.indentValue = yield* this.pushSpaces(false);
        if (this.indentNext > this.indentValue && !isEmpty(this.charAt(1)))
          this.indentNext = this.indentValue;
        return yield* this.parseBlockStart();
      }
      *parseBlockStart() {
        const [ch0, ch1] = this.peek(2);
        if (!ch1 && !this.atEnd)
          return this.setNext("block-start");
        if ((ch0 === "-" || ch0 === "?" || ch0 === ":") && isEmpty(ch1)) {
          const n = (yield* this.pushCount(1)) + (yield* this.pushSpaces(true));
          this.indentNext = this.indentValue + 1;
          this.indentValue += n;
          return "block-start";
        }
        return "doc";
      }
      *parseDocument() {
        yield* this.pushSpaces(true);
        const line = this.getLine();
        if (line === null)
          return this.setNext("doc");
        let n = yield* this.pushIndicators();
        switch (line[n]) {
          case "#":
            yield* this.pushCount(line.length - n);
          // fallthrough
          case void 0:
            yield* this.pushNewline();
            return yield* this.parseLineStart();
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel = 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            return "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "doc";
          case '"':
          case "'":
            return yield* this.parseQuotedScalar();
          case "|":
          case ">":
            n += yield* this.parseBlockScalarHeader();
            n += yield* this.pushSpaces(true);
            yield* this.pushCount(line.length - n);
            yield* this.pushNewline();
            return yield* this.parseBlockScalar();
          default:
            return yield* this.parsePlainScalar();
        }
      }
      *parseFlowCollection() {
        let nl, sp;
        let indent = -1;
        do {
          nl = yield* this.pushNewline();
          if (nl > 0) {
            sp = yield* this.pushSpaces(false);
            this.indentValue = indent = sp;
          } else {
            sp = 0;
          }
          sp += yield* this.pushSpaces(true);
        } while (nl + sp > 0);
        const line = this.getLine();
        if (line === null)
          return this.setNext("flow");
        if (indent !== -1 && indent < this.indentNext && line[0] !== "#" || indent === 0 && (line.startsWith("---") || line.startsWith("...")) && isEmpty(line[3])) {
          const atFlowEndMarker = indent === this.indentNext - 1 && this.flowLevel === 1 && (line[0] === "]" || line[0] === "}");
          if (!atFlowEndMarker) {
            this.flowLevel = 0;
            yield cst.FLOW_END;
            return yield* this.parseLineStart();
          }
        }
        let n = 0;
        while (line[n] === ",") {
          n += yield* this.pushCount(1);
          n += yield* this.pushSpaces(true);
          this.flowKey = false;
        }
        n += yield* this.pushIndicators();
        switch (line[n]) {
          case void 0:
            return "flow";
          case "#":
            yield* this.pushCount(line.length - n);
            return "flow";
          case "{":
          case "[":
            yield* this.pushCount(1);
            this.flowKey = false;
            this.flowLevel += 1;
            return "flow";
          case "}":
          case "]":
            yield* this.pushCount(1);
            this.flowKey = true;
            this.flowLevel -= 1;
            return this.flowLevel ? "flow" : "doc";
          case "*":
            yield* this.pushUntil(isNotAnchorChar);
            return "flow";
          case '"':
          case "'":
            this.flowKey = true;
            return yield* this.parseQuotedScalar();
          case ":": {
            const next = this.charAt(1);
            if (this.flowKey || isEmpty(next) || next === ",") {
              this.flowKey = false;
              yield* this.pushCount(1);
              yield* this.pushSpaces(true);
              return "flow";
            }
          }
          // fallthrough
          default:
            this.flowKey = false;
            return yield* this.parsePlainScalar();
        }
      }
      *parseQuotedScalar() {
        const quote = this.charAt(0);
        let end = this.buffer.indexOf(quote, this.pos + 1);
        if (quote === "'") {
          while (end !== -1 && this.buffer[end + 1] === "'")
            end = this.buffer.indexOf("'", end + 2);
        } else {
          while (end !== -1) {
            let n = 0;
            while (this.buffer[end - 1 - n] === "\\")
              n += 1;
            if (n % 2 === 0)
              break;
            end = this.buffer.indexOf('"', end + 1);
          }
        }
        const qb = this.buffer.substring(0, end);
        let nl = qb.indexOf("\n", this.pos);
        if (nl !== -1) {
          while (nl !== -1) {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = qb.indexOf("\n", cs);
          }
          if (nl !== -1) {
            end = nl - (qb[nl - 1] === "\r" ? 2 : 1);
          }
        }
        if (end === -1) {
          if (!this.atEnd)
            return this.setNext("quoted-scalar");
          end = this.buffer.length;
        }
        yield* this.pushToIndex(end + 1, false);
        return this.flowLevel ? "flow" : "doc";
      }
      *parseBlockScalarHeader() {
        this.blockScalarIndent = -1;
        this.blockScalarKeep = false;
        let i = this.pos;
        while (true) {
          const ch = this.buffer[++i];
          if (ch === "+")
            this.blockScalarKeep = true;
          else if (ch > "0" && ch <= "9")
            this.blockScalarIndent = Number(ch) - 1;
          else if (ch !== "-")
            break;
        }
        return yield* this.pushUntil((ch) => isEmpty(ch) || ch === "#");
      }
      *parseBlockScalar() {
        let nl = this.pos - 1;
        let indent = 0;
        let ch;
        loop: for (let i2 = this.pos; ch = this.buffer[i2]; ++i2) {
          switch (ch) {
            case " ":
              indent += 1;
              break;
            case "\n":
              nl = i2;
              indent = 0;
              break;
            case "\r": {
              const next = this.buffer[i2 + 1];
              if (!next && !this.atEnd)
                return this.setNext("block-scalar");
              if (next === "\n")
                break;
            }
            // fallthrough
            default:
              break loop;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("block-scalar");
        if (indent >= this.indentNext) {
          if (this.blockScalarIndent === -1)
            this.indentNext = indent;
          else {
            this.indentNext = this.blockScalarIndent + (this.indentNext === 0 ? 1 : this.indentNext);
          }
          do {
            const cs = this.continueScalar(nl + 1);
            if (cs === -1)
              break;
            nl = this.buffer.indexOf("\n", cs);
          } while (nl !== -1);
          if (nl === -1) {
            if (!this.atEnd)
              return this.setNext("block-scalar");
            nl = this.buffer.length;
          }
        }
        let i = nl + 1;
        ch = this.buffer[i];
        while (ch === " ")
          ch = this.buffer[++i];
        if (ch === "	") {
          while (ch === "	" || ch === " " || ch === "\r" || ch === "\n")
            ch = this.buffer[++i];
          nl = i - 1;
        } else if (!this.blockScalarKeep) {
          do {
            let i2 = nl - 1;
            let ch2 = this.buffer[i2];
            if (ch2 === "\r")
              ch2 = this.buffer[--i2];
            const lastChar = i2;
            while (ch2 === " ")
              ch2 = this.buffer[--i2];
            if (ch2 === "\n" && i2 >= this.pos && i2 + 1 + indent > lastChar)
              nl = i2;
            else
              break;
          } while (true);
        }
        yield cst.SCALAR;
        yield* this.pushToIndex(nl + 1, true);
        return yield* this.parseLineStart();
      }
      *parsePlainScalar() {
        const inFlow = this.flowLevel > 0;
        let end = this.pos - 1;
        let i = this.pos - 1;
        let ch;
        while (ch = this.buffer[++i]) {
          if (ch === ":") {
            const next = this.buffer[i + 1];
            if (isEmpty(next) || inFlow && flowIndicatorChars.has(next))
              break;
            end = i;
          } else if (isEmpty(ch)) {
            let next = this.buffer[i + 1];
            if (ch === "\r") {
              if (next === "\n") {
                i += 1;
                ch = "\n";
                next = this.buffer[i + 1];
              } else
                end = i;
            }
            if (next === "#" || inFlow && flowIndicatorChars.has(next))
              break;
            if (ch === "\n") {
              const cs = this.continueScalar(i + 1);
              if (cs === -1)
                break;
              i = Math.max(i, cs - 2);
            }
          } else {
            if (inFlow && flowIndicatorChars.has(ch))
              break;
            end = i;
          }
        }
        if (!ch && !this.atEnd)
          return this.setNext("plain-scalar");
        yield cst.SCALAR;
        yield* this.pushToIndex(end + 1, true);
        return inFlow ? "flow" : "doc";
      }
      *pushCount(n) {
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos += n;
          return n;
        }
        return 0;
      }
      *pushToIndex(i, allowEmpty) {
        const s = this.buffer.slice(this.pos, i);
        if (s) {
          yield s;
          this.pos += s.length;
          return s.length;
        } else if (allowEmpty)
          yield "";
        return 0;
      }
      *pushIndicators() {
        let n = 0;
        loop: while (true) {
          switch (this.charAt(0)) {
            case "!":
              n += yield* this.pushTag();
              n += yield* this.pushSpaces(true);
              continue loop;
            case "&":
              n += yield* this.pushUntil(isNotAnchorChar);
              n += yield* this.pushSpaces(true);
              continue loop;
            case "-":
            // this is an error
            case "?":
            // this is an error outside flow collections
            case ":": {
              const inFlow = this.flowLevel > 0;
              const ch1 = this.charAt(1);
              if (isEmpty(ch1) || inFlow && flowIndicatorChars.has(ch1)) {
                if (!inFlow)
                  this.indentNext = this.indentValue + 1;
                else if (this.flowKey)
                  this.flowKey = false;
                n += yield* this.pushCount(1);
                n += yield* this.pushSpaces(true);
                continue loop;
              }
            }
          }
          break loop;
        }
        return n;
      }
      *pushTag() {
        if (this.charAt(1) === "<") {
          let i = this.pos + 2;
          let ch = this.buffer[i];
          while (!isEmpty(ch) && ch !== ">")
            ch = this.buffer[++i];
          return yield* this.pushToIndex(ch === ">" ? i + 1 : i, false);
        } else {
          let i = this.pos + 1;
          let ch = this.buffer[i];
          while (ch) {
            if (tagChars.has(ch))
              ch = this.buffer[++i];
            else if (ch === "%" && hexDigits.has(this.buffer[i + 1]) && hexDigits.has(this.buffer[i + 2])) {
              ch = this.buffer[i += 3];
            } else
              break;
          }
          return yield* this.pushToIndex(i, false);
        }
      }
      *pushNewline() {
        const ch = this.buffer[this.pos];
        if (ch === "\n")
          return yield* this.pushCount(1);
        else if (ch === "\r" && this.charAt(1) === "\n")
          return yield* this.pushCount(2);
        else
          return 0;
      }
      *pushSpaces(allowTabs) {
        let i = this.pos - 1;
        let ch;
        do {
          ch = this.buffer[++i];
        } while (ch === " " || allowTabs && ch === "	");
        const n = i - this.pos;
        if (n > 0) {
          yield this.buffer.substr(this.pos, n);
          this.pos = i;
        }
        return n;
      }
      *pushUntil(test) {
        let i = this.pos;
        let ch = this.buffer[i];
        while (!test(ch))
          ch = this.buffer[++i];
        return yield* this.pushToIndex(i, false);
      }
    };
    exports.Lexer = Lexer;
  }
});

// node_modules/yaml/dist/parse/line-counter.js
var require_line_counter = __commonJS({
  "node_modules/yaml/dist/parse/line-counter.js"(exports) {
    "use strict";
    var LineCounter = class {
      constructor() {
        this.lineStarts = [];
        this.addNewLine = (offset) => this.lineStarts.push(offset);
        this.linePos = (offset) => {
          let low = 0;
          let high = this.lineStarts.length;
          while (low < high) {
            const mid = low + high >> 1;
            if (this.lineStarts[mid] < offset)
              low = mid + 1;
            else
              high = mid;
          }
          if (this.lineStarts[low] === offset)
            return { line: low + 1, col: 1 };
          if (low === 0)
            return { line: 0, col: offset };
          const start = this.lineStarts[low - 1];
          return { line: low, col: offset - start + 1 };
        };
      }
    };
    exports.LineCounter = LineCounter;
  }
});

// node_modules/yaml/dist/parse/parser.js
var require_parser = __commonJS({
  "node_modules/yaml/dist/parse/parser.js"(exports) {
    "use strict";
    var node_process = __require("process");
    var cst = require_cst();
    var lexer = require_lexer();
    function includesToken(list, type) {
      for (let i = 0; i < list.length; ++i)
        if (list[i].type === type)
          return true;
      return false;
    }
    function findNonEmptyIndex(list) {
      for (let i = 0; i < list.length; ++i) {
        switch (list[i].type) {
          case "space":
          case "comment":
          case "newline":
            break;
          default:
            return i;
        }
      }
      return -1;
    }
    function isFlowToken(token) {
      switch (token?.type) {
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
        case "flow-collection":
          return true;
        default:
          return false;
      }
    }
    function getPrevProps(parent) {
      switch (parent.type) {
        case "document":
          return parent.start;
        case "block-map": {
          const it = parent.items[parent.items.length - 1];
          return it.sep ?? it.start;
        }
        case "block-seq":
          return parent.items[parent.items.length - 1].start;
        /* istanbul ignore next should not happen */
        default:
          return [];
      }
    }
    function getFirstKeyStartProps(prev) {
      if (prev.length === 0)
        return [];
      let i = prev.length;
      loop: while (--i >= 0) {
        switch (prev[i].type) {
          case "doc-start":
          case "explicit-key-ind":
          case "map-value-ind":
          case "seq-item-ind":
          case "newline":
            break loop;
        }
      }
      while (prev[++i]?.type === "space") {
      }
      return prev.splice(i, prev.length);
    }
    function arrayPushArray(target, source) {
      if (source.length < 1e5)
        Array.prototype.push.apply(target, source);
      else
        for (let i = 0; i < source.length; ++i)
          target.push(source[i]);
    }
    function fixFlowSeqItems(fc) {
      if (fc.start.type === "flow-seq-start") {
        for (const it of fc.items) {
          if (it.sep && !it.value && !includesToken(it.start, "explicit-key-ind") && !includesToken(it.sep, "map-value-ind")) {
            if (it.key)
              it.value = it.key;
            delete it.key;
            if (isFlowToken(it.value)) {
              if (it.value.end)
                arrayPushArray(it.value.end, it.sep);
              else
                it.value.end = it.sep;
            } else
              arrayPushArray(it.start, it.sep);
            delete it.sep;
          }
        }
      }
    }
    var Parser = class {
      /**
       * @param onNewLine - If defined, called separately with the start position of
       *   each new line (in `parse()`, including the start of input).
       */
      constructor(onNewLine) {
        this.atNewLine = true;
        this.atScalar = false;
        this.indent = 0;
        this.offset = 0;
        this.onKeyLine = false;
        this.stack = [];
        this.source = "";
        this.type = "";
        this.lexer = new lexer.Lexer();
        this.onNewLine = onNewLine;
      }
      /**
       * Parse `source` as a YAML stream.
       * If `incomplete`, a part of the last line may be left as a buffer for the next call.
       *
       * Errors are not thrown, but yielded as `{ type: 'error', message }` tokens.
       *
       * @returns A generator of tokens representing each directive, document, and other structure.
       */
      *parse(source, incomplete = false) {
        if (this.onNewLine && this.offset === 0)
          this.onNewLine(0);
        for (const lexeme of this.lexer.lex(source, incomplete))
          yield* this.next(lexeme);
        if (!incomplete)
          yield* this.end();
      }
      /**
       * Advance the parser by the `source` of one lexical token.
       */
      *next(source) {
        this.source = source;
        if (node_process.env.LOG_TOKENS)
          console.log("|", cst.prettyToken(source));
        if (this.atScalar) {
          this.atScalar = false;
          yield* this.step();
          this.offset += source.length;
          return;
        }
        const type = cst.tokenType(source);
        if (!type) {
          const message = `Not a YAML token: ${source}`;
          yield* this.pop({ type: "error", offset: this.offset, message, source });
          this.offset += source.length;
        } else if (type === "scalar") {
          this.atNewLine = false;
          this.atScalar = true;
          this.type = "scalar";
        } else {
          this.type = type;
          yield* this.step();
          switch (type) {
            case "newline":
              this.atNewLine = true;
              this.indent = 0;
              if (this.onNewLine)
                this.onNewLine(this.offset + source.length);
              break;
            case "space":
              if (this.atNewLine && source[0] === " ")
                this.indent += source.length;
              break;
            case "explicit-key-ind":
            case "map-value-ind":
            case "seq-item-ind":
              if (this.atNewLine)
                this.indent += source.length;
              break;
            case "doc-mode":
            case "flow-error-end":
              return;
            default:
              this.atNewLine = false;
          }
          this.offset += source.length;
        }
      }
      /** Call at end of input to push out any remaining constructions */
      *end() {
        while (this.stack.length > 0)
          yield* this.pop();
      }
      get sourceToken() {
        const st = {
          type: this.type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
        return st;
      }
      *step() {
        const top = this.peek(1);
        if (this.type === "doc-end" && top?.type !== "doc-end") {
          while (this.stack.length > 0)
            yield* this.pop();
          this.stack.push({
            type: "doc-end",
            offset: this.offset,
            source: this.source
          });
          return;
        }
        if (!top)
          return yield* this.stream();
        switch (top.type) {
          case "document":
            return yield* this.document(top);
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return yield* this.scalar(top);
          case "block-scalar":
            return yield* this.blockScalar(top);
          case "block-map":
            return yield* this.blockMap(top);
          case "block-seq":
            return yield* this.blockSequence(top);
          case "flow-collection":
            return yield* this.flowCollection(top);
          case "doc-end":
            return yield* this.documentEnd(top);
        }
        yield* this.pop();
      }
      peek(n) {
        return this.stack[this.stack.length - n];
      }
      *pop(error) {
        const token = error ?? this.stack.pop();
        if (!token) {
          const message = "Tried to pop an empty stack";
          yield { type: "error", offset: this.offset, source: "", message };
        } else if (this.stack.length === 0) {
          yield token;
        } else {
          const top = this.peek(1);
          if (token.type === "block-scalar") {
            token.indent = "indent" in top ? top.indent : 0;
          } else if (token.type === "flow-collection" && top.type === "document") {
            token.indent = 0;
          }
          if (token.type === "flow-collection")
            fixFlowSeqItems(token);
          switch (top.type) {
            case "document":
              top.value = token;
              break;
            case "block-scalar":
              top.props.push(token);
              break;
            case "block-map": {
              const it = top.items[top.items.length - 1];
              if (it.value) {
                top.items.push({ start: [], key: token, sep: [] });
                this.onKeyLine = true;
                return;
              } else if (it.sep) {
                it.value = token;
              } else {
                Object.assign(it, { key: token, sep: [] });
                this.onKeyLine = !it.explicitKey;
                return;
              }
              break;
            }
            case "block-seq": {
              const it = top.items[top.items.length - 1];
              if (it.value)
                top.items.push({ start: [], value: token });
              else
                it.value = token;
              break;
            }
            case "flow-collection": {
              const it = top.items[top.items.length - 1];
              if (!it || it.value)
                top.items.push({ start: [], key: token, sep: [] });
              else if (it.sep)
                it.value = token;
              else
                Object.assign(it, { key: token, sep: [] });
              return;
            }
            /* istanbul ignore next should not happen */
            default:
              yield* this.pop();
              yield* this.pop(token);
          }
          if ((top.type === "document" || top.type === "block-map" || top.type === "block-seq") && (token.type === "block-map" || token.type === "block-seq")) {
            const last = token.items[token.items.length - 1];
            if (last && !last.sep && !last.value && last.start.length > 0 && findNonEmptyIndex(last.start) === -1 && (token.indent === 0 || last.start.every((st) => st.type !== "comment" || st.indent < token.indent))) {
              if (top.type === "document")
                top.end = last.start;
              else
                top.items.push({ start: last.start });
              token.items.splice(-1, 1);
            }
          }
        }
      }
      *stream() {
        switch (this.type) {
          case "directive-line":
            yield { type: "directive", offset: this.offset, source: this.source };
            return;
          case "byte-order-mark":
          case "space":
          case "comment":
          case "newline":
            yield this.sourceToken;
            return;
          case "doc-mode":
          case "doc-start": {
            const doc = {
              type: "document",
              offset: this.offset,
              start: []
            };
            if (this.type === "doc-start")
              doc.start.push(this.sourceToken);
            this.stack.push(doc);
            return;
          }
        }
        yield {
          type: "error",
          offset: this.offset,
          message: `Unexpected ${this.type} token in YAML stream`,
          source: this.source
        };
      }
      *document(doc) {
        if (doc.value)
          return yield* this.lineEnd(doc);
        switch (this.type) {
          case "doc-start": {
            if (findNonEmptyIndex(doc.start) !== -1) {
              yield* this.pop();
              yield* this.step();
            } else
              doc.start.push(this.sourceToken);
            return;
          }
          case "anchor":
          case "tag":
          case "space":
          case "comment":
          case "newline":
            doc.start.push(this.sourceToken);
            return;
        }
        const bv = this.startBlockValue(doc);
        if (bv)
          this.stack.push(bv);
        else {
          yield {
            type: "error",
            offset: this.offset,
            message: `Unexpected ${this.type} token in YAML document`,
            source: this.source
          };
        }
      }
      *scalar(scalar) {
        if (this.type === "map-value-ind") {
          const prev = getPrevProps(this.peek(2));
          const start = getFirstKeyStartProps(prev);
          let sep;
          if (scalar.end) {
            sep = scalar.end;
            sep.push(this.sourceToken);
            delete scalar.end;
          } else
            sep = [this.sourceToken];
          const map = {
            type: "block-map",
            offset: scalar.offset,
            indent: scalar.indent,
            items: [{ start, key: scalar, sep }]
          };
          this.onKeyLine = true;
          this.stack[this.stack.length - 1] = map;
        } else
          yield* this.lineEnd(scalar);
      }
      *blockScalar(scalar) {
        switch (this.type) {
          case "space":
          case "comment":
          case "newline":
            scalar.props.push(this.sourceToken);
            return;
          case "scalar":
            scalar.source = this.source;
            this.atNewLine = true;
            this.indent = 0;
            if (this.onNewLine) {
              let nl = this.source.indexOf("\n") + 1;
              while (nl !== 0) {
                this.onNewLine(this.offset + nl);
                nl = this.source.indexOf("\n", nl) + 1;
              }
            }
            yield* this.pop();
            break;
          /* istanbul ignore next should not happen */
          default:
            yield* this.pop();
            yield* this.step();
        }
      }
      *blockMap(map) {
        const it = map.items[map.items.length - 1];
        switch (this.type) {
          case "newline":
            this.onKeyLine = false;
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              it.start.push(this.sourceToken);
            }
            return;
          case "space":
          case "comment":
            if (it.value) {
              map.items.push({ start: [this.sourceToken] });
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              if (this.atIndentedComment(it.start, map.indent)) {
                const prev = map.items[map.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  arrayPushArray(end, it.start);
                  end.push(this.sourceToken);
                  map.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
        }
        if (this.indent >= map.indent) {
          const atMapIndent = !this.onKeyLine && this.indent === map.indent;
          const atNextItem = atMapIndent && (it.sep || it.explicitKey) && this.type !== "seq-item-ind";
          let start = [];
          if (atNextItem && it.sep && !it.value) {
            const nl = [];
            for (let i = 0; i < it.sep.length; ++i) {
              const st = it.sep[i];
              switch (st.type) {
                case "newline":
                  nl.push(i);
                  break;
                case "space":
                  break;
                case "comment":
                  if (st.indent > map.indent)
                    nl.length = 0;
                  break;
                default:
                  nl.length = 0;
              }
            }
            if (nl.length >= 2)
              start = it.sep.splice(nl[1]);
          }
          switch (this.type) {
            case "anchor":
            case "tag":
              if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start });
                this.onKeyLine = true;
              } else if (it.sep) {
                it.sep.push(this.sourceToken);
              } else {
                it.start.push(this.sourceToken);
              }
              return;
            case "explicit-key-ind":
              if (!it.sep && !it.explicitKey) {
                it.start.push(this.sourceToken);
                it.explicitKey = true;
              } else if (atNextItem || it.value) {
                start.push(this.sourceToken);
                map.items.push({ start, explicitKey: true });
              } else {
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start: [this.sourceToken], explicitKey: true }]
                });
              }
              this.onKeyLine = true;
              return;
            case "map-value-ind":
              if (it.explicitKey) {
                if (!it.sep) {
                  if (includesToken(it.start, "newline")) {
                    Object.assign(it, { key: null, sep: [this.sourceToken] });
                  } else {
                    const start2 = getFirstKeyStartProps(it.start);
                    this.stack.push({
                      type: "block-map",
                      offset: this.offset,
                      indent: this.indent,
                      items: [{ start: start2, key: null, sep: [this.sourceToken] }]
                    });
                  }
                } else if (it.value) {
                  map.items.push({ start: [], key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start, key: null, sep: [this.sourceToken] }]
                  });
                } else if (isFlowToken(it.key) && !includesToken(it.sep, "newline")) {
                  const start2 = getFirstKeyStartProps(it.start);
                  const key = it.key;
                  const sep = it.sep;
                  sep.push(this.sourceToken);
                  delete it.key;
                  delete it.sep;
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: start2, key, sep }]
                  });
                } else if (start.length > 0) {
                  it.sep = it.sep.concat(start, this.sourceToken);
                } else {
                  it.sep.push(this.sourceToken);
                }
              } else {
                if (!it.sep) {
                  Object.assign(it, { key: null, sep: [this.sourceToken] });
                } else if (it.value || atNextItem) {
                  map.items.push({ start, key: null, sep: [this.sourceToken] });
                } else if (includesToken(it.sep, "map-value-ind")) {
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: [], key: null, sep: [this.sourceToken] }]
                  });
                } else {
                  it.sep.push(this.sourceToken);
                }
              }
              this.onKeyLine = true;
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs = this.flowScalar(this.type);
              if (atNextItem || it.value) {
                map.items.push({ start, key: fs, sep: [] });
                this.onKeyLine = true;
              } else if (it.sep) {
                this.stack.push(fs);
              } else {
                Object.assign(it, { key: fs, sep: [] });
                this.onKeyLine = true;
              }
              return;
            }
            default: {
              const bv = this.startBlockValue(map);
              if (bv) {
                if (bv.type === "block-seq") {
                  if (!it.explicitKey && it.sep && !includesToken(it.sep, "newline")) {
                    yield* this.pop({
                      type: "error",
                      offset: this.offset,
                      message: "Unexpected block-seq-ind on same line with key",
                      source: this.source
                    });
                    return;
                  }
                } else if (atMapIndent) {
                  map.items.push({ start });
                }
                this.stack.push(bv);
                return;
              }
            }
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *blockSequence(seq) {
        const it = seq.items[seq.items.length - 1];
        switch (this.type) {
          case "newline":
            if (it.value) {
              const end = "end" in it.value ? it.value.end : void 0;
              const last = Array.isArray(end) ? end[end.length - 1] : void 0;
              if (last?.type === "comment")
                end?.push(this.sourceToken);
              else
                seq.items.push({ start: [this.sourceToken] });
            } else
              it.start.push(this.sourceToken);
            return;
          case "space":
          case "comment":
            if (it.value)
              seq.items.push({ start: [this.sourceToken] });
            else {
              if (this.atIndentedComment(it.start, seq.indent)) {
                const prev = seq.items[seq.items.length - 2];
                const end = prev?.value?.end;
                if (Array.isArray(end)) {
                  arrayPushArray(end, it.start);
                  end.push(this.sourceToken);
                  seq.items.pop();
                  return;
                }
              }
              it.start.push(this.sourceToken);
            }
            return;
          case "anchor":
          case "tag":
            if (it.value || this.indent <= seq.indent)
              break;
            it.start.push(this.sourceToken);
            return;
          case "seq-item-ind":
            if (this.indent !== seq.indent)
              break;
            if (it.value || includesToken(it.start, "seq-item-ind"))
              seq.items.push({ start: [this.sourceToken] });
            else
              it.start.push(this.sourceToken);
            return;
        }
        if (this.indent > seq.indent) {
          const bv = this.startBlockValue(seq);
          if (bv) {
            this.stack.push(bv);
            return;
          }
        }
        yield* this.pop();
        yield* this.step();
      }
      *flowCollection(fc) {
        const it = fc.items[fc.items.length - 1];
        if (this.type === "flow-error-end") {
          let top;
          do {
            yield* this.pop();
            top = this.peek(1);
          } while (top?.type === "flow-collection");
        } else if (fc.end.length === 0) {
          switch (this.type) {
            case "comma":
            case "explicit-key-ind":
              if (!it || it.sep)
                fc.items.push({ start: [this.sourceToken] });
              else
                it.start.push(this.sourceToken);
              return;
            case "map-value-ind":
              if (!it || it.value)
                fc.items.push({ start: [], key: null, sep: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                Object.assign(it, { key: null, sep: [this.sourceToken] });
              return;
            case "space":
            case "comment":
            case "newline":
            case "anchor":
            case "tag":
              if (!it || it.value)
                fc.items.push({ start: [this.sourceToken] });
              else if (it.sep)
                it.sep.push(this.sourceToken);
              else
                it.start.push(this.sourceToken);
              return;
            case "alias":
            case "scalar":
            case "single-quoted-scalar":
            case "double-quoted-scalar": {
              const fs = this.flowScalar(this.type);
              if (!it || it.value)
                fc.items.push({ start: [], key: fs, sep: [] });
              else if (it.sep)
                this.stack.push(fs);
              else
                Object.assign(it, { key: fs, sep: [] });
              return;
            }
            case "flow-map-end":
            case "flow-seq-end":
              fc.end.push(this.sourceToken);
              return;
          }
          const bv = this.startBlockValue(fc);
          if (bv)
            this.stack.push(bv);
          else {
            yield* this.pop();
            yield* this.step();
          }
        } else {
          const parent = this.peek(2);
          if (parent.type === "block-map" && (this.type === "map-value-ind" && parent.indent === fc.indent || this.type === "newline" && !parent.items[parent.items.length - 1].sep)) {
            yield* this.pop();
            yield* this.step();
          } else if (this.type === "map-value-ind" && parent.type !== "flow-collection") {
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            fixFlowSeqItems(fc);
            const sep = fc.end.splice(1, fc.end.length);
            sep.push(this.sourceToken);
            const map = {
              type: "block-map",
              offset: fc.offset,
              indent: fc.indent,
              items: [{ start, key: fc, sep }]
            };
            this.onKeyLine = true;
            this.stack[this.stack.length - 1] = map;
          } else {
            yield* this.lineEnd(fc);
          }
        }
      }
      flowScalar(type) {
        if (this.onNewLine) {
          let nl = this.source.indexOf("\n") + 1;
          while (nl !== 0) {
            this.onNewLine(this.offset + nl);
            nl = this.source.indexOf("\n", nl) + 1;
          }
        }
        return {
          type,
          offset: this.offset,
          indent: this.indent,
          source: this.source
        };
      }
      startBlockValue(parent) {
        switch (this.type) {
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar":
            return this.flowScalar(this.type);
          case "block-scalar-header":
            return {
              type: "block-scalar",
              offset: this.offset,
              indent: this.indent,
              props: [this.sourceToken],
              source: ""
            };
          case "flow-map-start":
          case "flow-seq-start":
            return {
              type: "flow-collection",
              offset: this.offset,
              indent: this.indent,
              start: this.sourceToken,
              items: [],
              end: []
            };
          case "seq-item-ind":
            return {
              type: "block-seq",
              offset: this.offset,
              indent: this.indent,
              items: [{ start: [this.sourceToken] }]
            };
          case "explicit-key-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            start.push(this.sourceToken);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, explicitKey: true }]
            };
          }
          case "map-value-ind": {
            this.onKeyLine = true;
            const prev = getPrevProps(parent);
            const start = getFirstKeyStartProps(prev);
            return {
              type: "block-map",
              offset: this.offset,
              indent: this.indent,
              items: [{ start, key: null, sep: [this.sourceToken] }]
            };
          }
        }
        return null;
      }
      atIndentedComment(start, indent) {
        if (this.type !== "comment")
          return false;
        if (this.indent <= indent)
          return false;
        return start.every((st) => st.type === "newline" || st.type === "space");
      }
      *documentEnd(docEnd) {
        if (this.type !== "doc-mode") {
          if (docEnd.end)
            docEnd.end.push(this.sourceToken);
          else
            docEnd.end = [this.sourceToken];
          if (this.type === "newline")
            yield* this.pop();
        }
      }
      *lineEnd(token) {
        switch (this.type) {
          case "comma":
          case "doc-start":
          case "doc-end":
          case "flow-seq-end":
          case "flow-map-end":
          case "map-value-ind":
            yield* this.pop();
            yield* this.step();
            break;
          case "newline":
            this.onKeyLine = false;
          // fallthrough
          case "space":
          case "comment":
          default:
            if (token.end)
              token.end.push(this.sourceToken);
            else
              token.end = [this.sourceToken];
            if (this.type === "newline")
              yield* this.pop();
        }
      }
    };
    exports.Parser = Parser;
  }
});

// node_modules/yaml/dist/public-api.js
var require_public_api = __commonJS({
  "node_modules/yaml/dist/public-api.js"(exports) {
    "use strict";
    var composer = require_composer();
    var Document = require_Document();
    var errors = require_errors();
    var log = require_log();
    var identity = require_identity();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    function parseOptions(options) {
      const prettyErrors = options.prettyErrors !== false;
      const lineCounter$1 = options.lineCounter || prettyErrors && new lineCounter.LineCounter() || null;
      return { lineCounter: lineCounter$1, prettyErrors };
    }
    function parseAllDocuments(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      const docs = Array.from(composer$1.compose(parser$1.parse(source)));
      if (prettyErrors && lineCounter2)
        for (const doc of docs) {
          doc.errors.forEach(errors.prettifyError(source, lineCounter2));
          doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
        }
      if (docs.length > 0)
        return docs;
      return Object.assign([], { empty: true }, composer$1.streamInfo());
    }
    function parseDocument2(source, options = {}) {
      const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
      const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
      const composer$1 = new composer.Composer(options);
      let doc = null;
      for (const _doc of composer$1.compose(parser$1.parse(source), true, source.length)) {
        if (!doc)
          doc = _doc;
        else if (doc.options.logLevel !== "silent") {
          doc.errors.push(new errors.YAMLParseError(_doc.range.slice(0, 2), "MULTIPLE_DOCS", "Source contains multiple documents; please use YAML.parseAllDocuments()"));
          break;
        }
      }
      if (prettyErrors && lineCounter2) {
        doc.errors.forEach(errors.prettifyError(source, lineCounter2));
        doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
      }
      return doc;
    }
    function parse(src, reviver, options) {
      let _reviver = void 0;
      if (typeof reviver === "function") {
        _reviver = reviver;
      } else if (options === void 0 && reviver && typeof reviver === "object") {
        options = reviver;
      }
      const doc = parseDocument2(src, options);
      if (!doc)
        return null;
      doc.warnings.forEach((warning) => log.warn(doc.options.logLevel, warning));
      if (doc.errors.length > 0) {
        if (doc.options.logLevel !== "silent")
          throw doc.errors[0];
        else
          doc.errors = [];
      }
      return doc.toJS(Object.assign({ reviver: _reviver }, options));
    }
    function stringify(value, replacer, options) {
      let _replacer = null;
      if (typeof replacer === "function" || Array.isArray(replacer)) {
        _replacer = replacer;
      } else if (options === void 0 && replacer) {
        options = replacer;
      }
      if (typeof options === "string")
        options = options.length;
      if (typeof options === "number") {
        const indent = Math.round(options);
        options = indent < 1 ? void 0 : indent > 8 ? { indent: 8 } : { indent };
      }
      if (value === void 0) {
        const { keepUndefined } = options ?? replacer ?? {};
        if (!keepUndefined)
          return void 0;
      }
      if (identity.isDocument(value) && !_replacer)
        return value.toString(options);
      return new Document.Document(value, _replacer, options).toString(options);
    }
    exports.parse = parse;
    exports.parseAllDocuments = parseAllDocuments;
    exports.parseDocument = parseDocument2;
    exports.stringify = stringify;
  }
});

// node_modules/yaml/dist/index.js
var require_dist = __commonJS({
  "node_modules/yaml/dist/index.js"(exports) {
    "use strict";
    var composer = require_composer();
    var Document = require_Document();
    var Schema = require_Schema();
    var errors = require_errors();
    var Alias = require_Alias();
    var identity = require_identity();
    var Pair = require_Pair();
    var Scalar2 = require_Scalar();
    var YAMLMap = require_YAMLMap();
    var YAMLSeq = require_YAMLSeq();
    var cst = require_cst();
    var lexer = require_lexer();
    var lineCounter = require_line_counter();
    var parser = require_parser();
    var publicApi = require_public_api();
    var visit = require_visit();
    exports.Composer = composer.Composer;
    exports.Document = Document.Document;
    exports.Schema = Schema.Schema;
    exports.YAMLError = errors.YAMLError;
    exports.YAMLParseError = errors.YAMLParseError;
    exports.YAMLWarning = errors.YAMLWarning;
    exports.Alias = Alias.Alias;
    exports.isAlias = identity.isAlias;
    exports.isCollection = identity.isCollection;
    exports.isDocument = identity.isDocument;
    exports.isMap = identity.isMap;
    exports.isNode = identity.isNode;
    exports.isPair = identity.isPair;
    exports.isScalar = identity.isScalar;
    exports.isSeq = identity.isSeq;
    exports.Pair = Pair.Pair;
    exports.Scalar = Scalar2.Scalar;
    exports.YAMLMap = YAMLMap.YAMLMap;
    exports.YAMLSeq = YAMLSeq.YAMLSeq;
    exports.CST = cst;
    exports.Lexer = lexer.Lexer;
    exports.LineCounter = lineCounter.LineCounter;
    exports.Parser = parser.Parser;
    exports.parse = publicApi.parse;
    exports.parseAllDocuments = publicApi.parseAllDocuments;
    exports.parseDocument = publicApi.parseDocument;
    exports.stringify = publicApi.stringify;
    exports.visit = visit.visit;
    exports.visitAsync = visit.visitAsync;
  }
});

// src/cli.ts
var import_yaml7 = __toESM(require_dist(), 1);
import { readdirSync, readFileSync as readFileSync2, statSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import process from "node:process";

// src/bindings.ts
var import_yaml = __toESM(require_dist(), 1);

// src/config.ts
var current = {};
function configure(config2) {
  current = config2;
}
function config() {
  return current;
}

// src/text.ts
function outcomeTexts(outcome) {
  return (outcome ?? []).flatMap(
    (item) => typeof item === "string" ? [item] : [item.ui ?? "", item.observation ?? ""]
  );
}
var RACE_WINNER_FIRST = "first";
function raceWinnerText(winner) {
  return winner === RACE_WINNER_FIRST ? "whichever arrives first wins" : `${winner} wins`;
}
function nonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}
var PENDING_MARKERS = ["TBD", "TODO", "FIXME", "UNRESOLVED"];
function pendingMarkers() {
  return [...PENDING_MARKERS, ...config().pendingMarkers ?? []];
}
function findPendingMarker(text) {
  return pendingMarkers().find((m) => text.includes(m));
}

// src/bindings.ts
var ALLOWED_ROLES = /* @__PURE__ */ new Set([
  "button",
  "link",
  "textbox",
  "checkbox",
  "radio",
  "combobox",
  "listbox",
  "option",
  "menu",
  "menuitem",
  "dialog",
  "heading",
  "tab",
  "tabpanel",
  "row",
  "rowheader",
  "gridcell",
  "columnheader",
  "table",
  "grid",
  "list",
  "listitem",
  "spinbutton",
  "switch",
  "group",
  "region",
  "alert",
  "alertdialog",
  "slider",
  "status",
  "radiogroup"
]);
var CALLED_API_PATTERN = /^called[A-Z][A-Za-z0-9]*(Query|Mutation)$/;
function isRecord(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
var WEB = {
  elementKeys: ["role", "name", "label", "testid", "text", "note"],
  requiresGraph: true,
  checkEvent(id, e, findings) {
    if (typeof e.operation !== "string" || !/^[A-Z][A-Za-z0-9]*$/.test(e.operation)) {
      findings.push({
        level: "error",
        check: "bindings-events",
        message: `events.${id}: operation must be a PascalCase operation name: ${String(e.operation)}`
      });
      return;
    }
    if (e.kind !== "mutation" && e.kind !== "query") {
      findings.push({
        level: "error",
        check: "bindings-events",
        message: `events.${id}: kind must be mutation | query: ${String(e.kind)}`
      });
      return;
    }
    if (typeof e.called_api !== "string" || !CALLED_API_PATTERN.test(e.called_api)) {
      findings.push({
        level: "error",
        check: "bindings-events",
        message: `events.${id}: called_api must follow the called<Operation><Query|Mutation> form: ${String(e.called_api)}`
      });
      return;
    }
    const expected = `called${e.operation}${e.kind === "mutation" ? "Mutation" : "Query"}`;
    if (e.called_api !== expected) {
      findings.push({
        level: "error",
        check: "bindings-events",
        message: `events.${id}: called_api should be ${expected} (mechanically derived from operation/kind): ${e.called_api}`
      });
    }
  }
};
function platforms() {
  return { web: WEB, ...config().platforms };
}
function parseBindings(source) {
  const findings = [];
  let raw;
  try {
    raw = (0, import_yaml.parse)(source);
  } catch (e) {
    return {
      doc: void 0,
      findings: [
        {
          level: "error",
          check: "bindings-schema",
          message: `cannot parse YAML: ${e.message}`
        }
      ]
    };
  }
  if (!isRecord(raw)) {
    return {
      doc: void 0,
      findings: [
        {
          level: "error",
          check: "bindings-schema",
          message: "the top level must be a map"
        }
      ]
    };
  }
  for (const key of ["bindings", "platform", "elements"]) {
    if (!(key in raw)) {
      findings.push({
        level: "error",
        check: "bindings-schema",
        message: `required key ${key} is missing`
      });
    }
  }
  if (findings.some((f) => f.level === "error")) {
    return { doc: void 0, findings };
  }
  const doc = raw;
  if (typeof doc.bindings !== "string" || doc.bindings === "") {
    findings.push({
      level: "error",
      check: "bindings-schema",
      message: "bindings must be a string holding the target usecase id"
    });
  }
  const platform = platforms()[doc.platform];
  if (!platform) {
    findings.push({
      level: "error",
      check: "bindings-schema",
      message: `platform must be one of ${Object.keys(platforms()).join(" | ")}: ${String(doc.platform)}`
    });
  } else if (platform.requiresGraph && !doc.graph) {
    findings.push({
      level: "error",
      check: "bindings-schema",
      message: `graph is required when platform: ${doc.platform}`
    });
  }
  if (!isRecord(doc.elements)) {
    findings.push({
      level: "error",
      check: "bindings-schema",
      message: "elements must be a map"
    });
    return { doc: void 0, findings };
  }
  return { doc, findings };
}
function checkElements(doc, findings) {
  const platform = platforms()[doc.platform] ?? WEB;
  const allowedKeys = new Set(platform.elementKeys);
  const formKeys = [...allowedKeys].filter((k) => k !== "note" && k !== "name");
  const seenIdentity = /* @__PURE__ */ new Map();
  for (const [id, entry] of Object.entries(doc.elements)) {
    if (!isRecord(entry)) {
      findings.push({
        level: "error",
        check: "bindings-schema",
        message: `elements.${id}: must be a map`
      });
      continue;
    }
    const unknown = Object.keys(entry).filter((k) => !allowedKeys.has(k));
    if (unknown.length > 0) {
      findings.push({
        level: "error",
        check: "bindings-schema",
        message: `elements.${id}: unknown keys ${unknown.join(", ")} (allowed for platform ${doc.platform}: ${[...allowedKeys].join(", ")})`
      });
    }
    const e = entry;
    const forms = formKeys.filter(
      (k) => entry[k] !== void 0
    );
    if (forms.length !== 1) {
      findings.push({
        level: "error",
        check: "bindings-schema",
        message: `elements.${id}: exactly one addressing form (${formKeys.join("/")}) is required (currently: ${forms.length === 0 ? "none" : forms.join("+")})`
      });
      continue;
    }
    if (e.name !== void 0 && e.role === void 0) {
      findings.push({
        level: "error",
        check: "bindings-schema",
        message: `elements.${id}: name can only be used together with role`
      });
    }
    if (e.role !== void 0) {
      if (!ALLOWED_ROLES.has(e.role)) {
        findings.push({
          level: "error",
          check: "bindings-schema",
          message: `elements.${id}: unknown role ${e.role} (check the allowed role set in src/bindings.ts)`
        });
      }
      if (e.name === void 0) {
        findings.push({
          level: "warn",
          check: "bindings-schema",
          message: `elements.${id}: role has no name (unnamed roles are fragile under strict mode)`
        });
      }
    }
    if (e.testid !== void 0 && !/^[a-z][a-z0-9-]*$/.test(e.testid)) {
      findings.push({
        level: "error",
        check: "bindings-schema",
        message: `elements.${id}: testid must be static kebab-case: ${e.testid}`
      });
    }
    const formKey = forms[0];
    const identity = formKey === "role" ? `role:${e.role}:${e.name ?? ""}` : `${formKey}:${String(entry[formKey])}`;
    const prev = seenIdentity.get(identity);
    if (prev !== void 0) {
      findings.push({
        level: "warn",
        check: "bindings-unique",
        message: `elements.${id} and elements.${prev} share the same addressing (${identity}) \u2014 a strict mode violation waiting to happen`
      });
    } else {
      seenIdentity.set(identity, id);
    }
    platform.checkElement?.(id, e, findings);
  }
}
function checkEvents(doc, findings) {
  if (!doc.events) return;
  if (!isRecord(doc.events)) {
    findings.push({
      level: "error",
      check: "bindings-schema",
      message: "events must be a map"
    });
    return;
  }
  const platform = platforms()[doc.platform] ?? WEB;
  for (const [id, entry] of Object.entries(doc.events)) {
    if (!isRecord(entry)) {
      findings.push({
        level: "error",
        check: "bindings-schema",
        message: `events.${id}: must be a map`
      });
      continue;
    }
    platform.checkEvent?.(id, entry, findings);
  }
}
function checkLiterals(doc, findings) {
  if (!doc.literals) return;
  if (!isRecord(doc.literals)) {
    findings.push({
      level: "error",
      check: "bindings-schema",
      message: "literals must be a map (key \u2192 text)"
    });
    return;
  }
  for (const [key, value] of Object.entries(doc.literals)) {
    if (typeof value !== "string") {
      findings.push({
        level: "error",
        check: "bindings-schema",
        message: `literals.${key}: must be a string`
      });
      continue;
    }
    const m = findPendingMarker(value);
    if (m) {
      findings.push({
        level: "warn",
        check: "pending",
        message: `literals.${key}: a "${m}" marker remains (resolve before approval)`
      });
    }
  }
}
function checkLiteralCoverage(doc, model, findings) {
  const ruleIds = new Set((model.ir.rules ?? []).map((r) => r.id));
  const coverage = doc.literal_coverage ?? {};
  if (ruleIds.size === 0) return;
  for (const id of ruleIds) {
    if (!(id in coverage)) {
      findings.push({
        level: "error",
        check: "literal-coverage",
        message: `rule ${id} has no literal stance (literal: <key> | literal: TBD | ui_text: none)`
      });
    }
  }
  for (const [id, entry] of Object.entries(coverage)) {
    if (!ruleIds.has(id)) {
      findings.push({
        level: "error",
        check: "literal-coverage",
        message: `literal_coverage.${id}: rule id does not exist in the IR (a typo, or the rule was removed from the IR)`
      });
      continue;
    }
    if (!isRecord(entry)) {
      findings.push({
        level: "error",
        check: "literal-coverage",
        message: `literal_coverage.${id}: must be a map`
      });
      continue;
    }
    const hasLiteral = typeof entry.literal === "string";
    const isNone = entry.ui_text === "none";
    if (hasLiteral === isNone) {
      findings.push({
        level: "error",
        check: "literal-coverage",
        message: `literal_coverage.${id}: write exactly one of literal: <key> or ui_text: none`
      });
      continue;
    }
    if (hasLiteral) {
      const key = entry.literal;
      if (pendingMarkers().includes(key)) {
        findings.push({
          level: "warn",
          check: "pending",
          message: `literal_coverage.${id}: literal undecided (${key}) \u2014 resolve via the question list`
        });
      } else if (!(doc.literals && key in doc.literals)) {
        findings.push({
          level: "error",
          check: "literal-coverage",
          message: `literal_coverage.${id}: literals.${key} does not exist`
        });
      }
    }
  }
}
function runBindingsChecks(doc, options = {}) {
  const findings = [];
  checkElements(doc, findings);
  checkEvents(doc, findings);
  checkLiterals(doc, findings);
  const coverageShapeOk = doc.literal_coverage === void 0 || isRecord(doc.literal_coverage);
  if (!coverageShapeOk) {
    findings.push({
      level: "error",
      check: "bindings-schema",
      message: "literal_coverage must be a map (rule id \u2192 stance)"
    });
  }
  if (options.model) {
    if (doc.bindings !== options.model.ir.usecase) {
      findings.push({
        level: "error",
        check: "bindings-usecase",
        message: `the bindings target (${doc.bindings}) does not match the IR usecase (${options.model.ir.usecase})`
      });
    } else if (coverageShapeOk) {
      checkLiteralCoverage(doc, options.model, findings);
    }
  }
  return findings;
}

// src/assumptions.ts
var MARKER = /ASSUMED\(([^)\s]+)\)/g;
function textsOf(model) {
  const out = [];
  const add = (at, texts) => {
    for (const text of texts) if (typeof text === "string" && text) out.push({ at, text });
  };
  (model.ir.transitions ?? []).forEach((t, i) => add(`transitions[${i}]`, [...outcomeTexts(t.outcome), t.reason]));
  (model.ir.races ?? []).forEach((r, i) => add(`races[${i}]`, outcomeTexts(r.outcome)));
  (model.ir.rules ?? []).forEach(
    (rule) => rule.cases.forEach(
      (c, i) => add(`rules[${rule.id}].cases[${i}]`, [typeof c.expected === "string" ? c.expected : void 0])
    )
  );
  (model.ir.scenarios ?? []).forEach(
    (sc) => add(`scenarios[${sc.id}]`, [...sc.given ?? [], ...sc.when ?? [], ...sc.then ?? []])
  );
  (model.ir.inputs ?? []).forEach((inp) => add(`inputs[${inp.id}].na`, Object.values(inp.na ?? {})));
  return out;
}
function referencedAssumptions(model) {
  const refs = /* @__PURE__ */ new Map();
  for (const { at, text } of textsOf(model)) {
    for (const m of text.matchAll(MARKER)) {
      const id = m[1];
      refs.set(id, [...refs.get(id) ?? [], at]);
    }
  }
  return refs;
}
function declaredAssumptionIds(model) {
  const list = model.ir.assumptions;
  if (!Array.isArray(list)) return [];
  return list.map((a) => a?.id).filter((id) => typeof id === "string");
}
function checkAssumptions(model) {
  const findings = [];
  const push = (level, message) => findings.push({ level, check: "assumptions", message });
  const list = model.ir.assumptions;
  if (list !== void 0 && !Array.isArray(list)) {
    push("error", "assumptions must be a list");
    return findings;
  }
  const seen = /* @__PURE__ */ new Set();
  (list ?? []).forEach((a, i) => {
    const at = `assumptions[${i}]`;
    if (!nonEmptyString(a?.id)) {
      push("error", `${at}: id is required (use the question id, e.g. W4)`);
      return;
    }
    if (seen.has(a.id)) push("error", `${at}: duplicate assumption id: ${a.id}`);
    seen.add(a.id);
    for (const key of ["question", "proposal", "basis"]) {
      if (!nonEmptyString(a[key])) {
        push("error", `${at} (${a.id}): ${key} is required \u2014 an assumption with no ${key} cannot be reviewed`);
      }
    }
  });
  const refs = referencedAssumptions(model);
  for (const [id, places] of refs) {
    if (!seen.has(id)) push("error", `${places[0]}: ASSUMED(${id}) refers to an assumption that is not declared in assumptions`);
  }
  for (const id of seen) {
    if (!refs.has(id)) {
      push("warn", `assumptions (${id}): declared but no IR text carries ASSUMED(${id}) \u2014 apply it or remove it`);
    }
  }
  return findings;
}

// src/types.ts
function cellKey(from, on) {
  return `${from} ${on}`;
}

// src/checks.ts
function one(model, from, on) {
  return model.cells.get(cellKey(from, on))?.[0];
}
function nonTerminalStates(model) {
  return [...model.states.values()].filter((s) => !s.terminal).map((s) => s.id);
}
function transitionCells(model) {
  return [...model.cells.values()].flat().filter((c) => !c.impossible);
}
function undeclaredCells(model) {
  return nonTerminalStates(model).flatMap(
    (state) => [...model.events.keys()].filter((event) => !model.cells.has(cellKey(state, event))).map((event) => ({ state, event }))
  );
}
function checkExhaustiveness(model) {
  return undeclaredCells(model).map(({ state, event }) => {
    const label = model.events.get(event)?.label ?? event;
    return {
      level: "error",
      check: "exhaustiveness",
      message: `${state} \xD7 ${event}: undeclared. Answer "what happens when ${label} occurs in ${state}?" (define a transition, or declare impossible: true with a reason)`
    };
  });
}
function checkDeterminism(model) {
  const findings = [];
  for (const [key, list] of model.cells) {
    if (list.length > 1) {
      findings.push({
        level: "error",
        check: "determinism",
        message: `${key.replace(" ", " \xD7 ")}: has ${list.length} declarations (transitions[${list.map((c) => c.entryIndex).join("], transitions[")}]). Each cell must have exactly one declaration`
      });
    }
  }
  return findings;
}
function checkTerminals(model) {
  const findings = [];
  for (const c of transitionCells(model)) {
    if (model.states.get(c.from)?.terminal) {
      findings.push({
        level: "error",
        check: "terminals",
        message: `${c.from} is terminal but has an outgoing transition (on: ${c.on})`
      });
    }
  }
  return findings;
}
function checkReachability(model) {
  const findings = [];
  if (!model.initial) return findings;
  const reachable = /* @__PURE__ */ new Set([model.initial]);
  const queue = [model.initial];
  while (queue.length > 0) {
    const s = queue.shift();
    for (const c of transitionCells(model)) {
      if (c.from === s && c.to && !reachable.has(c.to)) {
        reachable.add(c.to);
        queue.push(c.to);
      }
    }
  }
  for (const s of model.states.keys()) {
    if (!reachable.has(s)) {
      findings.push({
        level: "error",
        check: "reachability",
        message: `${s}: cannot be reached from initial (${model.initial}) by any event sequence`
      });
    }
  }
  return findings;
}
function checkEscapability(model) {
  const findings = [];
  const terminals = [...model.states.values()].filter((s) => s.terminal).map((s) => s.id);
  if (terminals.length === 0) {
    findings.push({
      level: "error",
      check: "escapability",
      message: "there is no terminal state. At least one terminal state is required"
    });
    return findings;
  }
  const canEscape = new Set(terminals);
  let changed = true;
  while (changed) {
    changed = false;
    for (const c of transitionCells(model)) {
      if (c.to && canEscape.has(c.to) && !canEscape.has(c.from)) {
        canEscape.add(c.from);
        changed = true;
      }
    }
  }
  for (const s of nonTerminalStates(model)) {
    if (!canEscape.has(s)) {
      findings.push({
        level: "error",
        check: "escapability",
        message: `${s}: cannot reach any terminal state (a user who enters this state is stuck)`
      });
    }
  }
  return findings;
}
function undeclaredRaces(model) {
  const races = model.ir.races ?? [];
  const out = [];
  for (const state of nonTerminalStates(model)) {
    const active = [...model.events.values()].filter((e) => {
      const cell3 = one(model, state, e.id);
      return cell3 !== void 0 && !cell3.impossible;
    });
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i];
        const b = active[j];
        if (a.actor === b.actor) continue;
        const declared = races.some((r) => r.state === state && r.between.includes(a.id) && r.between.includes(b.id));
        if (!declared) out.push({ state, a, b });
      }
    }
  }
  return out;
}
function checkRaces(model) {
  return [
    ...checkRaceDeclarations(model),
    ...undeclaredRaces(model).map(({ state, a, b }) => ({
      level: "error",
      check: "races",
      message: `${state}: ${a.actor}'s ${a.id} and ${b.actor}'s ${b.id} can race. Declare in races "if they happen almost simultaneously, which one wins, and what does the user see?"`
    }))
  ];
}
function checkRaceDeclarations(model) {
  const findings = [];
  const races = model.ir.races ?? [];
  races.forEach((r, i) => {
    const at = `races[${i}]`;
    if (!model.states.has(r.state)) {
      findings.push({ level: "error", check: "races", message: `${at}: undefined state: ${r.state}` });
      return;
    }
    for (const e of r.between) {
      if (!model.events.has(e)) {
        findings.push({ level: "error", check: "races", message: `${at}: undefined event: ${e}` });
      } else {
        const cell3 = one(model, r.state, e);
        if (!cell3 || cell3.impossible) {
          findings.push({
            level: "warn",
            check: "races",
            message: `${at}: ${e} is not defined as a transition from ${r.state} (no race can occur)`
          });
        }
      }
    }
    if (r.winner !== RACE_WINNER_FIRST && !r.between.includes(r.winner)) {
      findings.push({
        level: "error",
        check: "races",
        message: `${at}: winner (${r.winner}) must be one of the between events, or first when arrival order decides it`
      });
    }
  });
  return findings;
}
function checkPaths(model) {
  const findings = [];
  if (!model.initial) return findings;
  for (const sc of model.ir.scenarios) {
    if (!sc.path) continue;
    let current2 = model.initial;
    for (const [i, event] of sc.path.entries()) {
      if (!model.events.has(event)) {
        findings.push({
          level: "error",
          check: "paths",
          message: `${sc.id}: path[${i}] references an undefined event: ${event}`
        });
        break;
      }
      const cell3 = one(model, current2, event);
      if (!cell3 || cell3.impossible) {
        findings.push({
          level: "error",
          check: "paths",
          message: `${sc.id}: path[${i}] ${event} cannot be executed from ${current2} ` + (cell3?.impossible ? `(${cell3.ignored ? "ignored" : "impossible"}: ${cell3.reason})` : "(no transition declared)")
        });
        break;
      }
      current2 = cell3.to;
    }
  }
  return findings;
}
function checkCoverage(model) {
  const findings = [];
  if (!model.initial) return findings;
  const covered = coveredCells(model);
  for (const c of transitionCells(model)) {
    if (!covered.has(cellKey(c.from, c.on))) {
      findings.push({
        level: "warn",
        check: "coverage",
        message: `${c.from} \xD7 ${c.on} \u2192 ${c.to}: not exercised by any scenario (--suggest-paths can propose candidate paths)`
      });
    }
  }
  return findings;
}
function coveredCells(model) {
  const covered = /* @__PURE__ */ new Set();
  if (!model.initial) return covered;
  for (const sc of model.ir.scenarios) {
    if (!sc.path) continue;
    let current2 = model.initial;
    for (const event of sc.path) {
      const cell3 = one(model, current2, event);
      if (!cell3 || cell3.impossible) break;
      covered.add(cellKey(current2, event));
      current2 = cell3.to;
    }
  }
  return covered;
}
function checkVocabulary(model, observationNames) {
  const findings = [];
  const visit = (items2, at) => {
    for (const item of items2 ?? []) {
      if (typeof item === "object" && item.observation) {
        if (!observationNames.has(item.observation)) {
          findings.push({
            level: "error",
            check: "vocabulary",
            message: `${at}: observation "${item.observation}" does not exist in the observations registry (--definitions)`
          });
        }
      }
    }
  };
  (model.ir.transitions ?? []).forEach((t, i) => visit(t.outcome, `transitions[${i}]`));
  (model.ir.races ?? []).forEach((r, i) => visit(r.outcome, `races[${i}]`));
  return findings;
}
function pendingInOutcome(outcome) {
  for (const t of outcomeTexts(outcome)) {
    const marker = findPendingMarker(t);
    if (marker) return marker;
  }
  return void 0;
}
function checkPending(model) {
  const findings = [];
  const push = (at, marker) => {
    findings.push({
      level: "warn",
      check: "pending",
      message: `${at}: an unanswered spec-question marker (${marker}) remains. Incorporate the spec owner's answer before approving`
    });
  };
  (model.ir.transitions ?? []).forEach((t, i) => {
    const m = pendingInOutcome(t.outcome) ?? (t.reason ? findPendingMarker(t.reason) : void 0);
    if (m) push(`transitions[${i}]`, m);
  });
  (model.ir.races ?? []).forEach((r, i) => {
    const m = pendingInOutcome(r.outcome);
    if (m) push(`races[${i}]`, m);
  });
  (model.ir.rules ?? []).forEach((rule) => {
    rule.cases.forEach((c, i) => {
      const m = typeof c.expected === "string" ? findPendingMarker(c.expected) : void 0;
      if (m) push(`rules[${rule.id}].cases[${i}]`, m);
    });
  });
  (model.ir.scenarios ?? []).forEach((sc) => {
    for (const t of sc.then ?? []) {
      if (typeof t !== "string") continue;
      const m = findPendingMarker(t);
      if (m) {
        push(`scenarios[${sc.id}].then`, m);
        break;
      }
    }
  });
  return findings;
}
var INPUT_DEFAULT_CONDITIONS = {
  field: ["empty", "boundary"],
  option: ["default", "set"]
};
function inputConditions(model) {
  const map = /* @__PURE__ */ new Map();
  for (const inp of model.ir.inputs ?? []) {
    const defaults = { ...INPUT_DEFAULT_CONDITIONS, ...config().inputConditions };
    map.set(inp.id, inp.conditions?.length ? inp.conditions : defaults[inp.kind] ?? []);
  }
  return map;
}
function toCoversArray(v) {
  if (v === void 0) return [];
  return Array.isArray(v) ? v : [v];
}
function uncoveredInputCells(model) {
  const conds = inputConditions(model);
  const covered = /* @__PURE__ */ new Set();
  const claim = (ref) => {
    const parts = ref.split("\xD7").map((x) => x.trim());
    if (parts.length === 2 && conds.get(parts[0])?.includes(parts[1])) covered.add(`${parts[0]}\xD7${parts[1]}`);
  };
  for (const sc of model.ir.scenarios ?? []) for (const ref of toCoversArray(sc.covers)) claim(ref);
  for (const rule of model.ir.rules ?? []) for (const c of rule.cases) for (const ref of toCoversArray(c.covers)) claim(ref);
  const out = [];
  for (const inp of model.ir.inputs ?? []) {
    for (const condition of conds.get(inp.id) ?? []) {
      const isNa = inp.na !== void 0 && condition in inp.na;
      if (!isNa && !covered.has(`${inp.id}\xD7${condition}`)) out.push({ input: inp.id, condition });
    }
  }
  return out;
}
function checkInputs(model) {
  const inputs = model.ir.inputs ?? [];
  if (inputs.length === 0) return [];
  const findings = [];
  const conds = inputConditions(model);
  for (const inp of inputs) {
    for (const cond of Object.keys(inp.na ?? {})) {
      if (!(conds.get(inp.id) ?? []).includes(cond)) {
        findings.push({
          level: "error",
          check: "inputs",
          message: `inputs (${inp.id}): na condition "${cond}" does not exist in this input's condition set (conditions: ${(conds.get(inp.id) ?? []).join(", ")})`
        });
      }
    }
  }
  const covered = /* @__PURE__ */ new Set();
  const claim = (ref, at) => {
    const parts = ref.split("\xD7").map((s) => s.trim());
    if (parts.length !== 2 || parts.some((p) => p === "")) {
      findings.push({
        level: "error",
        check: "inputs",
        message: `${at}: covers must use the "<inputId>\xD7<condition>" cell syntax: ${JSON.stringify(ref)}`
      });
      return;
    }
    const [id, cond] = parts;
    if (!conds.has(id)) {
      findings.push({
        level: "error",
        check: "inputs",
        message: `${at}: covers references an input id that is not declared in inputs: ${id}`
      });
      return;
    }
    if (!conds.get(id).includes(cond)) {
      findings.push({
        level: "error",
        check: "inputs",
        message: `${at}: covers condition "${cond}" does not exist in the condition set of input "${id}" (conditions: ${conds.get(id).join(", ")})`
      });
      return;
    }
    covered.add(`${id}\xD7${cond}`);
  };
  for (const sc of model.ir.scenarios ?? []) {
    for (const ref of toCoversArray(sc.covers)) claim(ref, `scenarios[${sc.id}]`);
  }
  for (const rule of model.ir.rules ?? []) {
    rule.cases.forEach((c, i) => {
      for (const ref of toCoversArray(c.covers)) claim(ref, `rules[${rule.id}].cases[${i}]`);
    });
  }
  for (const inp of inputs) {
    for (const cond of conds.get(inp.id) ?? []) {
      const key = `${inp.id}\xD7${cond}`;
      const isNa = inp.na !== void 0 && cond in inp.na;
      const isCovered = covered.has(key);
      if (isNa && isCovered) {
        findings.push({
          level: "warn",
          check: "inputs",
          message: `${key}: has both an na declaration and covers (the na reason may be stale \u2014 keep exactly one)`
        });
      }
      if (!isNa && !isCovered) {
        findings.push({
          level: "error",
          check: "inputs",
          message: `${inp.id} \xD7 ${cond}: uncovered. Answer "what happens when ${inp.id} is ${cond}?" (link it via covers from a rule case / scenario, or declare a reason under the input's na)`
        });
      }
    }
  }
  return findings;
}
function runChecks(model, options = {}) {
  const findings = [];
  findings.push(...checkPending(model));
  findings.push(...checkAssumptions(model));
  findings.push(...checkInputs(model));
  if (model.hasStateMachine) {
    findings.push(...checkDeterminism(model));
    findings.push(...checkExhaustiveness(model));
    findings.push(...checkTerminals(model));
    findings.push(...checkReachability(model));
    findings.push(...checkEscapability(model));
    findings.push(...checkRaces(model));
    findings.push(...checkPaths(model));
    findings.push(...checkCoverage(model));
  }
  if (options.observationNames) {
    findings.push(...checkVocabulary(model, options.observationNames));
  }
  return findings;
}

// src/definitions.ts
var import_yaml2 = __toESM(require_dist(), 1);
import { readFileSync } from "node:fs";
function loadObservationNames(definitionsPath) {
  const raw = (0, import_yaml2.parse)(readFileSync(definitionsPath, "utf8"));
  const names = /* @__PURE__ */ new Set();
  for (const [name, def] of Object.entries(raw?.observations ?? {})) {
    names.add(name);
    for (const key of Object.keys(def?.keys ?? {})) {
      names.add(key);
    }
  }
  return names;
}

// src/digest.ts
var DEFAULT_DIGEST_LABELS = {
  none: "(none)",
  spec: "spec",
  version: "version",
  not_recorded: "(not recorded)",
  states: "States and transitions",
  initial: "initial",
  terminal: "terminal",
  undefined: "undefined",
  ignored: "ignored",
  impossible: "impossible",
  no_reason: "(no reason)",
  races: "Races",
  race: "when {a} and {b} overlap, {winner}",
  winner_first: "whichever arrives first wins",
  winner: "{winner} wins",
  inputs: "Input axes",
  input_table: ["Input", "Condition", "Covered by"],
  not_applicable: "not applicable",
  not_covered: "not covered",
  rules: "Rules",
  scenarios: "Scenarios",
  path: "path",
  given: "given",
  when: "when",
  then: "then",
  assumptions: "Assumptions",
  assumptions_accepted: "Assumptions (accepted by approving)",
  assumption_table: ["ID", "Question", "Applied answer", "Basis"],
  no_assumptions: "none"
};
var labels = () => ({ ...DEFAULT_DIGEST_LABELS, ...config().digest });
var fill = (pattern, values) => pattern.replace(/\{(\w+)\}/g, (all, key) => values[key] ?? all);
var asList = (v) => v === void 0 ? [] : Array.isArray(v) ? v : [v];
function inline(v) {
  if (v === null || v === void 0) return labels().none;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(inline).join(" / ");
  if (typeof v === "object") {
    return Object.entries(v).map(([k, x]) => `${k}: ${inline(x)}`).join(" / ");
  }
  return String(v);
}
function items(v, indent) {
  if (Array.isArray(v)) return v.map((x) => `${indent}- ${inline(x)}`);
  return [`${indent}- ${inline(v)}`];
}
function outcomeLines(outcome, indent) {
  return (outcome ?? []).map((item) => {
    if (typeof item === "string") return `${indent}- ${item}`;
    const where = item.surface ? `[${item.surface}] ` : "";
    return `${indent}- ${where}${outcomeTexts([item]).filter(Boolean).join(" / ")}`;
  });
}
function stateMachine(model) {
  const l = labels();
  const out = [`## ${l.states}`, ""];
  for (const [id, state] of model.states) {
    const label = state.label ? ` (${state.label})` : "";
    const tag = id === model.initial ? ` \u2014 ${l.initial}` : state.terminal ? ` \u2014 ${l.terminal}` : "";
    out.push(`### ${id}${label}${tag}`, "");
    if (state.terminal) continue;
    for (const [on, ev] of model.events) {
      const cell3 = model.cells.get(cellKey(id, on))?.[0];
      const evLabel = `${on}${ev.label ? ` (${ev.label})` : ""} [${ev.actor}]`;
      if (!cell3) {
        out.push(`- **${evLabel}**: ${l.undefined}`);
      } else if (cell3.ignored) {
        out.push(`- ${evLabel}: ${l.ignored} \u2014 ${cell3.reason ?? l.no_reason}`);
      } else if (cell3.impossible) {
        out.push(`- ${evLabel}: ${l.impossible} \u2014 ${cell3.reason ?? l.no_reason}`);
      } else {
        out.push(`- **${evLabel}** \u2192 ${cell3.to}`, ...outcomeLines(cell3.outcome, "  "));
      }
    }
    out.push("");
  }
  const races = model.ir.races ?? [];
  if (races.length > 0) {
    out.push(`## ${l.races}`, "");
    for (const r of races) {
      const winner = r.winner === RACE_WINNER_FIRST ? l.winner_first : fill(l.winner, { winner: r.winner });
      out.push(`- ${r.state}: ${fill(l.race, { a: r.between[0], b: r.between[1], winner })}`, ...outcomeLines(r.outcome, "  "));
    }
    out.push("");
  }
  return out;
}
function inputsSection(model) {
  const inputs = model.ir.inputs ?? [];
  if (inputs.length === 0) return [];
  const coveredBy = /* @__PURE__ */ new Map();
  const add = (cell3, by) => coveredBy.set(cell3, [...coveredBy.get(cell3) ?? [], by]);
  for (const rule of model.ir.rules ?? []) {
    rule.cases.forEach((c, i) => {
      for (const cell3 of asList(c.covers)) add(cell3, `${rule.id}.cases[${i}]`);
    });
  }
  for (const sc of model.ir.scenarios ?? []) {
    for (const cell3 of asList(sc.covers)) add(cell3, sc.id);
  }
  const conds = inputConditions(model);
  const l = labels();
  const out = [`## ${l.inputs}`, "", `| ${l.input_table.join(" | ")} |`, "| --- | --- | --- |"];
  for (const inp of inputs) {
    for (const cond of conds.get(inp.id) ?? []) {
      const na = inp.na?.[cond];
      const by = coveredBy.get(`${inp.id}\xD7${cond}`);
      const how = na !== void 0 ? `${l.not_applicable} \u2014 ${na}` : by ? by.join(" / ") : `**${l.not_covered}**`;
      out.push(`| ${inp.id} | ${cond} | ${how.replaceAll("|", "\\|")} |`);
    }
  }
  out.push("");
  return out;
}
function rulesSection(model) {
  const rules = model.ir.rules ?? [];
  if (rules.length === 0) return [];
  const out = [`## ${labels().rules}`, ""];
  for (const rule of rules) {
    out.push(`### ${rule.id} ${rule.name}`, "");
    rule.cases.forEach((c, i) => {
      out.push(`- cases[${i}] ${inline(c.input)}`, ...items(c.expected, "  "));
    });
    out.push("");
  }
  return out;
}
function scenariosSection(model) {
  const l = labels();
  const out = [`## ${l.scenarios}`, ""];
  for (const sc of model.ir.scenarios ?? []) {
    out.push(`### ${sc.id} ${sc.name}${sc.critical ? " (critical)" : ""}`, "");
    if (sc.path) out.push(`- ${l.path}: ${sc.path.join(" \u2192 ")}`);
    for (const [label, list] of [
      [l.given, sc.given],
      [l.when, sc.when],
      [l.then, sc.then]
    ]) {
      if (list && list.length > 0) out.push(`- ${label}`, ...items(list, "  "));
    }
    out.push("");
  }
  return out;
}
function assumptionsSection(model) {
  const list = Array.isArray(model.ir.assumptions) ? model.ir.assumptions : [];
  const l = labels();
  if (list.length === 0) return [`## ${l.assumptions}`, "", l.no_assumptions, ""];
  const cell3 = (s) => inline(s).replaceAll("|", "\\|");
  const out = [
    `## ${l.assumptions_accepted}`,
    "",
    `| ${l.assumption_table.join(" | ")} |`,
    "| --- | --- | --- | --- |"
  ];
  for (const a of list) {
    out.push(`| ${cell3(a?.id)} | ${cell3(a?.question)} | ${cell3(a?.proposal)} | ${cell3(a?.basis)} |`);
  }
  out.push("");
  return out;
}
function renderDigest(model) {
  const { ir } = model;
  const out = [
    `# ${ir.usecase} ${ir.name}`,
    "",
    `- ${labels().spec}: ${ir.source.spec}`,
    `- ${labels().version}: ${ir.source.version ?? labels().not_recorded}`,
    ""
  ];
  if (model.hasStateMachine) out.push(...stateMachine(model));
  out.push(...inputsSection(model), ...rulesSection(model), ...scenariosSection(model), ...assumptionsSection(model));
  return `${out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}
`;
}

// src/approval.ts
import { basename } from "node:path";
var DATE = /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/;
function checkApproved(model, file) {
  const findings = [];
  const err = (message) => findings.push({ level: "error", check: "approval", message });
  const { source, usecase } = model.ir;
  const expected = `${usecase}.usecase.yaml`;
  if (basename(file) !== expected) {
    err(`the file name must match the usecase id: ${expected}`);
  }
  const parts = file.split(/[\\/]/);
  const at = parts.lastIndexOf("usecases");
  if (at >= 0 && parts.length - at !== 3) {
    err(`approved IRs live at usecases/<domain>/<usecase-id>.usecase.yaml: ${file}`);
  }
  if (!nonEmptyString(source.version)) {
    err("source.version (the approved spec version, e.g. its last-edited timestamp) is required");
  }
  const approval = source.approval;
  if (typeof approval !== "object" || approval === null || Array.isArray(approval)) {
    err("source.approval (approved_by / approved_at / record) is required");
    return findings;
  }
  if (!nonEmptyString(approval.approved_by)) {
    err("source.approval.approved_by (a string naming the approver) is required");
  }
  if (!nonEmptyString(approval.approved_at) || !DATE.test(approval.approved_at)) {
    err("source.approval.approved_at is required as YYYY-MM-DD (or ISO 8601)");
  }
  if (!nonEmptyString(approval.record) || !/^https:\/\//.test(approval.record)) {
    err("source.approval.record (an https URL where the approval itself lives) is required");
  }
  const declared = new Set(declaredAssumptionIds(model));
  const raw = approval.assumptions_accepted;
  if (raw !== void 0 && (!Array.isArray(raw) || !raw.every(nonEmptyString))) {
    err("source.approval.assumptions_accepted must be a list of assumption ids");
    return findings;
  }
  const accepted = new Set(raw ?? []);
  for (const id of declared) {
    if (!accepted.has(id)) {
      err(`assumption ${id} is applied but not accepted: add it to source.approval.assumptions_accepted, or replace it with the owner's answer`);
    }
  }
  for (const id of accepted) {
    if (!declared.has(id)) err(`source.approval.assumptions_accepted names ${id}, which is not declared in assumptions`);
  }
  return findings;
}
function escalatePending(findings) {
  return findings.map((f) => f.check === "pending" ? { ...f, level: "error" } : f);
}

// src/parse.ts
var import_yaml3 = __toESM(require_dist(), 1);
var STATE_ID = /^[A-Z][A-Z0-9_]*$/;
var EVENT_ID = /^[a-z][a-z0-9_]*$/;
var USECASE_ID = /^UC-[A-Z0-9-]+$/;
var SCENARIO_ID = /^SC-[A-Z0-9-]+$/;
var RULE_ID = /^RULE-[A-Z0-9-]+$/;
function toArray(v) {
  if (v === void 0) return [];
  return Array.isArray(v) ? v : [v];
}
function parseIR(source) {
  const findings = [];
  const err = (message) => findings.push({ level: "error", check: "structure", message });
  let raw;
  try {
    raw = (0, import_yaml3.parse)(source);
  } catch (e) {
    err(`cannot parse as YAML: ${e.message}`);
    return { findings };
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    err("the top level must be an object");
    return { findings };
  }
  const ir = raw;
  for (const message of flowSplitFindings((0, import_yaml3.parseDocument)(source))) err(message);
  if (!ir.usecase || !USECASE_ID.test(ir.usecase)) {
    err(`usecase must be an ID starting with UC- (e.g. UC-ORDER-CANCEL-001)`);
  }
  if (!ir.name) err("name is required");
  if (!ir.source?.spec) err("source.spec (link to the spec) is required");
  const hasStates = Array.isArray(ir.states) && ir.states.length > 0;
  const hasEvents = Array.isArray(ir.events) && ir.events.length > 0;
  const hasTransitions = Array.isArray(ir.transitions) && ir.transitions.length > 0;
  const hasStateMachine = hasStates || hasEvents || hasTransitions;
  if (hasStateMachine && !(hasStates && hasEvents && hasTransitions)) {
    err("states / events / transitions must be defined together as a set of three");
  }
  if (hasStates && !ir.initial) {
    err("initial (the initial state) is required when states are defined");
  }
  const states = /* @__PURE__ */ new Map();
  for (const s of ir.states ?? []) {
    if (!s?.id || !STATE_ID.test(s.id)) {
      err(`invalid state id: ${JSON.stringify(s?.id)} (UPPER_SNAKE_CASE)`);
      continue;
    }
    if (states.has(s.id)) err(`duplicate state id: ${s.id}`);
    states.set(s.id, s);
  }
  const events = /* @__PURE__ */ new Map();
  for (const e of ir.events ?? []) {
    if (!e?.id || !EVENT_ID.test(e.id)) {
      err(`invalid event id: ${JSON.stringify(e?.id)} (lower_snake_case)`);
      continue;
    }
    if (events.has(e.id)) err(`duplicate event id: ${e.id}`);
    const actors = config().actors;
    if (typeof e.actor !== "string" || e.actor.trim() === "") {
      err(`event ${e.id}: actor is required (e.g. customer / staff / system)`);
    } else if (actors && !actors.includes(e.actor)) {
      err(`event ${e.id}: actor must be one of ${actors.join(" | ")}: ${e.actor}`);
    }
    events.set(e.id, e);
  }
  if (ir.initial && hasStates && !states.has(ir.initial)) {
    err(`initial does not exist in states: ${ir.initial}`);
  }
  const cells = /* @__PURE__ */ new Map();
  (ir.transitions ?? []).forEach((t, i) => {
    const at = `transitions[${i}]`;
    const froms = toArray(t.from);
    const ons = toArray(t.on);
    if (froms.length === 0) err(`${at}: from is required`);
    if (ons.length === 0) err(`${at}: on is required`);
    if (t.impossible && t.ignored) {
      err(`${at}: impossible and ignored cannot be combined`);
    } else if (t.impossible || t.ignored) {
      const kind = t.impossible ? "impossible" : "ignored";
      if (!t.reason) err(`${at}: ${kind} requires a reason`);
      if (t.to || t.outcome) err(`${at}: ${kind} cannot be combined with to/outcome`);
    } else {
      if (!t.to)
        err(
          `${at}: to (the target state) is required (declare impossible: true if the transition cannot happen, or ignored: true if the event arrives but changes nothing)`
        );
      if (!t.outcome || t.outcome.length === 0) {
        err(`${at}: outcome (the observable expected result) is required`);
      }
    }
    for (const f of froms) {
      if (hasStates && !states.has(f)) err(`${at}: from references an undefined state: ${f}`);
      for (const o of ons) {
        if (hasEvents && !events.has(o)) err(`${at}: on references an undefined event: ${o}`);
        const key = cellKey(f, o);
        const list = cells.get(key) ?? [];
        list.push({
          from: f,
          on: o,
          to: t.to,
          outcome: t.outcome,
          impossible: t.impossible === true || t.ignored === true,
          ignored: t.ignored === true,
          reason: t.reason,
          entryIndex: i
        });
        cells.set(key, list);
      }
    }
    if (t.to && hasStates && !states.has(t.to)) {
      err(`${at}: to references an undefined state: ${t.to}`);
    }
  });
  if (!Array.isArray(ir.scenarios) || ir.scenarios.length === 0) {
    err("at least one scenario is required");
  } else {
    const seen = /* @__PURE__ */ new Set();
    ir.scenarios.forEach((sc, i) => {
      const at = `scenarios[${i}]`;
      if (!sc?.id || !SCENARIO_ID.test(sc.id)) {
        err(`${at}: id must be an ID starting with SC-`);
      } else if (seen.has(sc.id)) {
        err(`${at}: duplicate scenario id: ${sc.id}`);
      } else {
        seen.add(sc.id);
      }
      if (!sc?.name) err(`${at}: name is required`);
      if (hasStateMachine) {
        if (!sc?.path || sc.path.length === 0) {
          err(`${at} (${sc?.id}): scenarios of a use case with a state machine require a path`);
        }
      } else {
        if (!sc?.given?.length || !sc?.when?.length || !sc?.then?.length) {
          err(`${at} (${sc?.id}): given / when / then are all required`);
        }
      }
      for (const key of ["given", "when", "then"]) {
        const items2 = sc?.[key];
        if (items2 === void 0) continue;
        if (!Array.isArray(items2)) {
          err(`${at} (${sc?.id}): ${key} must be a list of strings`);
          continue;
        }
        items2.forEach((item, j) => {
          if (typeof item !== "string") {
            err(`${at} (${sc?.id}): ${key}[${j}] must be a string (the { surface, ui } form is for transition outcomes only)`);
          }
        });
      }
    });
  }
  (ir.races ?? []).forEach((r, i) => {
    const at = `races[${i}]`;
    if (!r?.state) err(`${at}: state is required`);
    if (!Array.isArray(r?.between) || r.between.length !== 2) {
      err(`${at}: between must be an array of exactly two events`);
    }
    if (!r?.winner) err(`${at}: winner is required`);
    if (!r?.outcome?.length) err(`${at}: outcome is required`);
  });
  (ir.rules ?? []).forEach((r, i) => {
    const at = `rules[${i}]`;
    if (!r?.id || !RULE_ID.test(r.id)) err(`${at}: id must be an ID starting with RULE-`);
    if (!r?.cases?.length) err(`${at}: at least one case is required`);
  });
  const INPUT_KINDS = /* @__PURE__ */ new Set(["field", "option"]);
  const inputIds = /* @__PURE__ */ new Set();
  (ir.inputs ?? []).forEach((inp, i) => {
    const at = `inputs[${i}]`;
    if (!inp?.id || typeof inp.id !== "string" || inp.id.trim() === "") {
      err(`${at}: id is required`);
      return;
    }
    if (inp.id.includes("\xD7")) {
      err(`${at}: id must not contain "\xD7" (it is the separator of the covers cell syntax "<inputId>\xD7<condition>")`);
    }
    if (inputIds.has(inp.id)) err(`${at}: duplicate input id: ${inp.id}`);
    inputIds.add(inp.id);
    if (!inp.kind || !INPUT_KINDS.has(inp.kind)) {
      err(`${at} (${inp.id}): kind must be one of field | option`);
    }
    if (inp.conditions !== void 0) {
      if (!Array.isArray(inp.conditions) || inp.conditions.length === 0) {
        err(`${at} (${inp.id}): conditions must be an array with at least one entry (omit it to use the kind-specific defaults)`);
      } else if (inp.conditions.some((c) => typeof c !== "string" || c.trim() === "")) {
        err(`${at} (${inp.id}): conditions must be an array of non-empty strings`);
      }
    }
    for (const [cond, reason] of Object.entries(inp.na ?? {})) {
      if (typeof reason !== "string" || reason.trim() === "") {
        err(`${at} (${inp.id}): na "${cond}" requires a reason (the same obligation as impossible's reason)`);
      }
    }
  });
  if (findings.some((f) => f.level === "error")) {
    return { findings };
  }
  return {
    findings,
    model: {
      ir,
      hasStateMachine,
      states,
      events,
      initial: ir.initial,
      cells
    }
  };
}
var BRACKET_PAIRS = [
  ["(", ")"],
  ["\u300C", "\u300D"],
  ["\uFF08", "\uFF09"]
];
function unbalancedBracket(text) {
  for (const [open, close] of BRACKET_PAIRS) {
    if (text.split(open).length !== text.split(close).length) {
      return `${open}${close}`;
    }
  }
  return void 0;
}
function plainString(node) {
  if (!(0, import_yaml3.isScalar)(node) || node.type !== import_yaml3.Scalar.PLAIN) return void 0;
  if (typeof node.value !== "string") return void 0;
  return node.source ?? node.value;
}
function plainSource(node) {
  if (!(0, import_yaml3.isScalar)(node) || node.type !== import_yaml3.Scalar.PLAIN) return void 0;
  return node.source ?? String(node.value);
}
function checkFlowSeq(node, at, out) {
  const fix = "use a block sequence (one `- item` per line) or wrap the item in double quotes";
  if ((0, import_yaml3.isMap)(node)) {
    for (const pair of node.items) {
      const key = (0, import_yaml3.isScalar)(pair.key) ? String(pair.key.value) : "?";
      const keySource = plainSource(pair.key);
      if (node.flow && pair.value === null && keySource !== void 0) {
        out.push(
          `${at}: a comma split a value in the flow mapping {...} (key "${keySource}" has no value); use block style (one \`key: value\` per line) or wrap the value in double quotes`
        );
        continue;
      }
      checkFlowSeq(pair.value, `${at}.${key}`, out);
    }
    return;
  }
  if (!(0, import_yaml3.isSeq)(node)) return;
  if (!node.flow) {
    node.items.forEach((item, j) => checkFlowSeq(item, `${at}[${j}]`, out));
    return;
  }
  const reported = /* @__PURE__ */ new Set();
  node.items.forEach((item, j) => {
    const text = plainSource(item);
    const prev = j > 0 ? plainSource(node.items[j - 1]) : void 0;
    if (text === void 0 || prev === void 0) return;
    const bothNumbers = [item, node.items[j - 1]].every(
      (n) => (0, import_yaml3.isScalar)(n) && typeof n.value === "number"
    );
    if (!bothNumbers && /\d$/.test(prev) && /^\d{3}(\D|$)/.test(text)) {
      reported.add(j - 1).add(j);
      out.push(
        `${at}[${j - 1}..${j}]: a comma in the flow sequence [...] split a number into "${prev}" and "${text}". If you meant "${prev},${text}", ${fix}`
      );
    }
  });
  node.items.forEach((item, j) => {
    if ((0, import_yaml3.isMap)(item) || (0, import_yaml3.isSeq)(item)) {
      checkFlowSeq(item, `${at}[${j}]`, out);
      return;
    }
    const text = plainString(item);
    if (text === void 0 || reported.has(j)) return;
    const bracket = unbalancedBracket(text);
    if (bracket !== void 0) {
      out.push(
        `${at}[${j}]: item "${text}" in the flow sequence [...] has an unclosed ${bracket} pair (a comma in the text may have split it); ${fix}`
      );
    }
  });
}
function flowSplitFindings(doc) {
  const out = [];
  const seqItems = (key) => {
    const node = doc.get(key, true);
    return (0, import_yaml3.isSeq)(node) ? node.items : [];
  };
  const label = (item) => {
    const id = (0, import_yaml3.isMap)(item) ? item.get("id") : void 0;
    return typeof id === "string" ? ` (${id})` : "";
  };
  seqItems("scenarios").forEach((sc, i) => {
    if (!(0, import_yaml3.isMap)(sc)) return;
    for (const key of ["given", "when", "then"]) {
      checkFlowSeq(
        sc.get(key, true),
        `scenarios[${i}]${label(sc)}.${key}`,
        out
      );
    }
  });
  for (const section of ["transitions", "races"]) {
    seqItems(section).forEach((t, i) => {
      if (!(0, import_yaml3.isMap)(t)) return;
      checkFlowSeq(t.get("outcome", true), `${section}[${i}].outcome`, out);
    });
  }
  seqItems("rules").forEach((r, i) => {
    if (!(0, import_yaml3.isMap)(r)) return;
    const cases = r.get("cases", true);
    if (!(0, import_yaml3.isSeq)(cases)) return;
    cases.items.forEach((c, j) => {
      if (!(0, import_yaml3.isMap)(c)) return;
      checkFlowSeq(
        c.get("expected", true),
        `rules[${i}]${label(r)}.cases[${j}].expected`,
        out
      );
    });
  });
  return out;
}

// src/prd.ts
var import_yaml4 = __toESM(require_dist(), 1);
var PRD_ID = /^PRD-[A-Z0-9-]+$/;
var STATUSES = ["draft", "in_review", "approved"];
var asStrings = (v) => Array.isArray(v) && v.every((x) => typeof x === "string");
function parsePrd(source) {
  const findings = [];
  const err = (message) => findings.push({ level: "error", check: "prd-structure", message });
  let raw;
  try {
    raw = (0, import_yaml4.parse)(source);
  } catch (e) {
    err(`cannot parse as YAML: ${e.message}`);
    return { findings };
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    err("the top level must be an object");
    return { findings };
  }
  const f = raw;
  if (!nonEmptyString(f["prd"]) || !PRD_ID.test(f["prd"])) err("prd must be an ID starting with PRD- (e.g. PRD-ORDER-CANCEL)");
  for (const key of ["title", "summary"]) {
    if (!nonEmptyString(f[key])) err(`${key} is required`);
  }
  if (!STATUSES.includes(f["status"])) err(`status must be one of ${STATUSES.join(" / ")}`);
  if (!asStrings(f["problem"]) || f["problem"].length === 0) err("problem must be a non-empty list of statements");
  if (!Array.isArray(f["users"]) || f["users"].length === 0) {
    err("users must list at least one user (id + description)");
  } else {
    f["users"].forEach((u, i) => {
      if (!nonEmptyString(u?.id) || !nonEmptyString(u?.description)) err(`users[${i}]: id and description are required`);
    });
  }
  if (!Array.isArray(f["goals"]) || f["goals"].length === 0) {
    err("goals must list at least one goal");
  } else {
    f["goals"].forEach((g, i) => {
      if (!nonEmptyString(g?.id) || !nonEmptyString(g?.statement)) err(`goals[${i}]: id and statement are required`);
      if (!nonEmptyString(g?.metric)) err(`goals[${i}]: metric is required (write TBD if it is not decided yet)`);
    });
  }
  if (!asStrings(f["non_goals"])) err("non_goals is required (write [] when nothing is left out on purpose)");
  if (!asStrings(f["usecases"]) || f["usecases"].length === 0) err("usecases must list at least one IR file");
  const sections = f["sections"];
  if (sections !== void 0 && (typeof sections !== "object" || sections === null || Array.isArray(sections))) {
    err("sections must be a map of section id to Markdown");
  }
  const questions = f["questions"];
  if (questions !== void 0) {
    if (!Array.isArray(questions)) err("questions must be a list of { question, proposal? }");
    else questions.forEach((q, i) => {
      if (!nonEmptyString(q?.question)) err(`questions[${i}]: question is required`);
      if (q?.proposal !== void 0 && !nonEmptyString(q.proposal)) err(`questions[${i}]: proposal must be text`);
    });
  }
  if (findings.length > 0) return { findings };
  return { frame: raw, findings };
}
function framePending(frame) {
  const texts = [
    { at: "summary", section: "summary", text: frame.summary },
    ...frame.problem.map((text, i) => ({ at: `problem[${i}]`, section: "problem", text })),
    ...frame.goals.flatMap(
      (g) => [
        ["statement", g.statement, 1],
        ["metric", g.metric, 2],
        ["target", g.target ?? "", 3]
      ].map(([field, text, column]) => ({ at: `goals[${g.id}].${field}`, section: "goals", goal: { id: g.id, statement: g.statement, column }, text }))
    ),
    ...Object.entries(frame.sections ?? {}).map(([k, v]) => ({ at: `sections.${k}`, section: k, text: String(v) }))
  ];
  return texts.flatMap((t) => {
    const marker = findPendingMarker(t.text);
    return marker ? [{ ...t, marker }] : [];
  });
}
function checkPrd(frame, models) {
  const findings = [];
  const warn = (check, message) => findings.push({ level: "warn", check, message });
  for (const { at, marker } of framePending(frame)) {
    warn("prd-pending", `${at}: an unanswered marker (${marker}) remains. Ask the PRD owner`);
  }
  for (const q of frame.questions ?? []) {
    warn("prd-questions", `an open question remains: ${q.question}. Ask the PRD owner`);
  }
  const users = new Set(frame.users.map((u) => u.id));
  const seen = /* @__PURE__ */ new Set();
  for (const model of models) {
    if (seen.has(model.ir.usecase)) {
      findings.push({ level: "error", check: "prd-usecases", message: `${model.ir.usecase} is linked twice` });
    }
    seen.add(model.ir.usecase);
    for (const ev of model.events.values()) {
      if (!users.has(ev.actor)) {
        warn("prd-actors", `${model.ir.usecase}: the actor "${ev.actor}" of event ${ev.id} is not among users. Say who it is`);
      }
    }
  }
  return findings;
}
var BUILT_IN_SECTIONS = ["summary", "problem", "users", "goals", "non_goals", "use_case_list", "use_cases", "open_questions"];
var DEFAULT_PROFILE = {
  title: true,
  fold: [],
  sections: [
    { id: "summary", heading: "Summary" },
    { id: "problem", heading: "Problem" },
    { id: "users", heading: "Users" },
    { id: "goals", heading: "Goals and metrics" },
    { id: "non_goals", heading: "Non-goals" },
    { id: "use_cases", heading: "Use cases and requirements" },
    { id: "open_questions", heading: "Open questions" }
  ],
  phrases: {
    transition: "While {state}, when {actor} does \u201C{event}\u201D, the system shall move to {to}.",
    stay: "While {state}, when {actor} does \u201C{event}\u201D, the system shall stay in {state}.",
    ignored: "While {state}, when {actor} does \u201C{event}\u201D, the system shall change nothing ({reason}).",
    impossible: "While {state}, \u201C{event}\u201D does not occur: {reason}.",
    race: "While {state}, if \u201C{a}\u201D and \u201C{b}\u201D happen at the same time, \u201C{winner}\u201D wins.",
    race_first: "While {state}, if \u201C{a}\u201D and \u201C{b}\u201D happen at the same time, whichever arrives first wins.",
    undeclared: "While {state}, what happens when {actor} does \u201C{event}\u201D?",
    unraced: "While {state}, if {a_actor} does \u201C{a}\u201D and {b_actor} does \u201C{b}\u201D at the same time, which one wins, and what does each side see?",
    uncovered: "What happens when {input} is {condition}?",
    assumed: " (assumed: {id})"
  },
  labels: {
    requirements: "Requirements",
    not_applicable: "Cases that do not occur",
    races: "Simultaneous operations",
    rules: "Rules",
    acceptance: "Acceptance criteria",
    inputs: "Input conditions",
    assumed: "Assumed answers (final when the IRs are approved)",
    open_questions_none: "None. Every check passes and no answer is waiting for review.",
    critical: "critical",
    given: "Given",
    when: "When",
    then: "Then",
    and: "And",
    goal_table: ["ID", "Goal", "Metric", "Target"],
    rule_table: ["Input", "Expected"],
    proposal: "proposed",
    input_table: ["Input", "Condition", "Handled by"],
    assumed_table: ["ID", "Question", "Applied answer", "Basis"],
    source: "Source"
  }
};
function mergeProfile(override) {
  const o = override ?? {};
  return {
    title: typeof o.title === "boolean" ? o.title : DEFAULT_PROFILE.title,
    sections: Array.isArray(o.sections) ? o.sections : DEFAULT_PROFILE.sections,
    fold: Array.isArray(o.fold) ? o.fold : DEFAULT_PROFILE.fold,
    phrases: { ...DEFAULT_PROFILE.phrases, ...o.phrases ?? {} },
    labels: { ...DEFAULT_PROFILE.labels, ...o.labels ?? {} }
  };
}
function checkProfile(frame, profile) {
  const placed = new Set(profile.sections.flatMap((s) => s.id ? [s.id] : []));
  const unplaced = Object.keys(frame.sections ?? {}).filter((id) => !placed.has(id)).map((id) => ({
    level: "warn",
    check: "prd-sections",
    message: `sections.${id} is not placed by the profile, so the rendered PRD leaves it out`
  }));
  return [...unplaced, ...profile.sections.flatMap((s) => s.id && s.required && !BUILT_IN_SECTIONS.includes(s.id) ? [{ ...s, id: s.id }] : []).filter((s) => !nonEmptyString(frame.sections?.[s.id])).map((s) => ({
    level: "warn",
    check: "prd-sections",
    message: `sections.${s.id} (${s.heading}) is required by the profile but missing`
  }))];
}
var fill2 = (pattern, values) => pattern.replace(/\{(\w+)\}/g, (all, key) => values[key] ?? all);
var cell = (v) => (typeof v === "string" ? v : JSON.stringify(v)).replaceAll("|", "\\|").replaceAll("\n", " ");
var table = (head, rows) => [
  `| ${head.join(" | ")} |`,
  `| ${head.map(() => "---").join(" | ")} |`,
  ...rows.map((r) => `| ${r.map(cell).join(" | ")} |`)
];
function outcomeLines2(outcome) {
  return (outcome ?? []).map((item) => {
    const where = typeof item !== "string" && item.surface ? `[${item.surface}] ` : "";
    return `  - ${where}${outcomeTexts([item]).filter(Boolean).join(" / ")}`;
  });
}
function namer(model, frame) {
  const actors = new Map(frame.users.map((u) => [u.id, u.label ?? u.id]));
  return {
    state: (id) => model.states.get(id)?.label ?? id,
    event: (id) => model.events.get(id)?.label ?? id,
    actor: (id) => actors.get(id) ?? id
  };
}
function useCaseSection(uc, frame, p, level) {
  const name = namer(uc.model, frame);
  const h = (below) => "#".repeat(level + below);
  const { model, file } = uc;
  const { ir } = model;
  const stateName = (id) => model.states.get(id)?.label ?? id;
  const eventName = (id) => model.events.get(id)?.label ?? id;
  const sub = (key, body) => p.fold.includes(key) ? ["<details>", `<summary>${p.labels[key]}</summary>`, "", ...body, "", "</details>", ""] : [`${h(2)} ${p.labels[key]}`, "", ...body, ""];
  const out = [`${h(1)} ${ir.name} (${ir.usecase})`, "", `${p.labels.source}: \`${file}\``, ""];
  if (model.hasStateMachine) {
    const reqs = /* @__PURE__ */ new Map();
    const na = /* @__PURE__ */ new Map();
    for (const [sid, state] of model.states) {
      if (state.terminal) continue;
      for (const [eid] of model.events) {
        const c = model.cells.get(cellKey(sid, eid))?.[0];
        if (!c) continue;
        if (c.impossible) {
          const d = na.get(c.entryIndex) ?? { states: /* @__PURE__ */ new Set(), events: /* @__PURE__ */ new Set(), reason: c.reason ?? "" };
          d.states.add(stateName(sid));
          d.events.add(eventName(eid));
          na.set(c.entryIndex, d);
          continue;
        }
        const key = c.to === sid ? `${sid}:${eid}` : `${c.entryIndex}:${eid}`;
        const g = reqs.get(key) ?? { states: [], event: eid, to: c.to, cell: c };
        g.states.push(sid);
        reqs.set(key, g);
      }
    }
    const reqLines = [...reqs.values()].flatMap(({ states, event, cell: c }) => {
      const values = { state: states.map(stateName).join(" / "), event: eventName(event), actor: name.actor(model.events.get(event).actor), to: c.to ? stateName(c.to) : "", reason: c.reason ?? "" };
      if (c.ignored) return [`- ${fill2(p.phrases.ignored, values)}`];
      return [`- ${fill2(c.to === states[0] ? p.phrases.stay : p.phrases.transition, values)}`, ...outcomeLines2(c.outcome)];
    });
    out.push(...sub("requirements", reqLines));
    if (na.size > 0) {
      const join2 = quoteJoin(p.phrases.impossible, "event");
      const lines = [...na.entries()].sort(([a], [b]) => a - b).map(([, d]) => {
        const values = { state: [...d.states].join(" / "), event: [...d.events].join(join2), reason: d.reason };
        return `- ${fill2(p.phrases.impossible, values)}`;
      });
      out.push(...sub("not_applicable", lines));
    }
    const races = ir.races ?? [];
    if (races.length > 0) {
      const lines = races.flatMap((r) => {
        const values = { state: stateName(r.state), a: eventName(r.between[0]), b: eventName(r.between[1]), winner: eventName(r.winner) };
        return [`- ${fill2(r.winner === RACE_WINNER_FIRST ? p.phrases.race_first : p.phrases.race, values)}`, ...outcomeLines2(r.outcome)];
      });
      out.push(...sub("races", lines));
    }
  }
  const rules = ir.rules ?? [];
  if (rules.length > 0) {
    const lines = rules.flatMap((rule) => [`**${rule.name}** (${rule.id})`, "", ...table(p.labels.rule_table, rule.cases.map((c) => [cell(c.input), cell(c.expected)])), ""]);
    lines.pop();
    out.push(...sub("rules", lines));
  }
  const inputs = ir.inputs ?? [];
  if (inputs.length > 0) {
    const by = /* @__PURE__ */ new Map();
    const add = (k, v) => by.set(k, [...by.get(k) ?? [], v]);
    for (const rule of rules) for (const c of rule.cases) for (const k of [c.covers ?? []].flat()) add(k, rule.id);
    for (const sc of ir.scenarios) for (const k of [sc.covers ?? []].flat()) add(k, sc.id);
    const rows = [...by.entries()].map(([k, v]) => [...k.split("\xD7"), v.join(", ")]);
    for (const inp of inputs) for (const [cond, reason] of Object.entries(inp.na ?? {})) rows.push([inp.id, cond, `n/a: ${reason}`]);
    out.push(...sub("inputs", table(p.labels.input_table, rows)));
  }
  const acceptance = [];
  for (const sc of ir.scenarios) {
    acceptance.push(`- **${sc.name}** (${sc.id}${sc.critical ? `, ${p.labels.critical}` : ""})`);
    for (const [kw, list] of [[p.labels.given, sc.given], [p.labels.when, sc.when], [p.labels.then, sc.then]]) {
      (list ?? []).forEach((line, i) => acceptance.push(`  - ${i === 0 ? kw : p.labels.and} ${line}`));
    }
  }
  out.push(...sub("acceptance", acceptance));
  return out;
}
function irPending(model) {
  const stateName = (id) => model.states.get(id)?.label ?? id;
  const eventName = (id) => model.events.get(id)?.label ?? id;
  const out = [];
  const add = (where, texts) => {
    for (const text of texts) if (findPendingMarker(text)) out.push({ where, text });
  };
  for (const list of model.cells.values()) {
    for (const c of list) add(`${stateName(c.from)} \xD7 ${eventName(c.on)}`, [...outcomeTexts(c.outcome), c.reason ?? ""]);
  }
  for (const r of model.ir.races ?? []) {
    add(`${stateName(r.state)}: ${eventName(r.between[0])} \xD7 ${eventName(r.between[1])}`, outcomeTexts(r.outcome));
  }
  for (const rule of model.ir.rules ?? []) {
    for (const c of rule.cases) add(`${rule.name}: ${cell(c.input)}`, typeof c.expected === "string" ? [c.expected] : []);
  }
  for (const sc of model.ir.scenarios) add(sc.name, sc.then ?? []);
  return out;
}
function quoteJoin(phrase, key) {
  const quoted = new RegExp(`(.)\\{${key}\\}(.)`).exec(phrase);
  return quoted ? `${quoted[2]} / ${quoted[1]}` : " / ";
}
function groupRaces(races, eventOrder) {
  const groups = [];
  let rest = races;
  while (rest.length > 0) {
    const count = (id) => rest.filter((r) => r.a.id === id || r.b.id === id).length;
    const shared = eventOrder.filter((id) => count(id) > 0).sort((x, y) => count(y) - count(x))[0];
    const mine = rest.filter((r) => r.a.id === shared || r.b.id === shared);
    rest = rest.filter((r) => !mine.includes(r));
    const byActor = /* @__PURE__ */ new Map();
    for (const r of mine) {
      const [own, other] = r.a.id === shared ? [r.a, r.b] : [r.b, r.a];
      const g = byActor.get(other.actor) ?? { shared: own, others: [], states: [] };
      if (!g.others.some((e) => e.id === other.id)) g.others.push(other);
      if (!g.states.includes(r.state)) g.states.push(r.state);
      byActor.set(other.actor, g);
    }
    groups.push(...byActor.values());
  }
  return groups;
}
function irQuestions(model, frame, p) {
  const name = namer(model, frame);
  const cells = undeclaredCells(model).map(
    ({ state, event }) => fill2(p.phrases.undeclared, { state: name.state(state), event: name.event(event), actor: name.actor(model.events.get(event).actor) })
  );
  const races = groupRaces(undeclaredRaces(model), [...model.events.keys()]).map(
    (g) => fill2(p.phrases.unraced, {
      state: g.states.map(name.state).join(" / "),
      a: name.event(g.shared.id),
      a_actor: name.actor(g.shared.actor),
      b: g.others.map((e) => name.event(e.id)).join(quoteJoin(p.phrases.unraced, "b")),
      b_actor: name.actor(g.others[0].actor)
    })
  );
  const uncovered = uncoveredInputCells(model).map((c) => fill2(p.phrases.uncovered, { input: c.input, condition: c.condition }));
  const ids = [
    ...[...model.states.keys()].map((id) => [id, name.state(id)]),
    ...[...model.events.keys()].map((id) => [id, name.event(id)]),
    ...frame.users.map((u) => [u.id, name.actor(u.id)])
  ].sort(([a], [b]) => b.length - a.length);
  const labeled = (text) => ids.reduce((t, [id, label]) => t.replace(new RegExp(`\\b${id}\\b`, "g"), () => label), text);
  const others = [
    // coverage is filled by the author (--suggest-paths), not decided by the owner
    // an uncovered input cell is worded above; the other inputs findings (a bad covers reference) stay as the checker words them
    ...runChecks(model).filter((f) => !["pending", "exhaustiveness", "races", "coverage"].includes(f.check) && !(f.check === "inputs" && f.message.includes(": uncovered."))),
    ...checkRaceDeclarations(model)
  ].map((f) => labeled(f.message));
  return [...cells, ...races, ...uncovered, ...others];
}
function openQuestions(frame, ucs, frameFindings, p) {
  const heading = (id) => p.sections.find((s) => s.id === id)?.heading ?? id;
  const questions = [
    ...(frame.problem ? framePending(frame) : []).map((f) => {
      const where = f.goal ? `${heading(f.section)} ${f.goal.id} ${p.labels.goal_table[f.goal.column]}` : heading(f.section);
      const of = f.goal && f.goal.column !== 1 ? ` (${f.goal.statement})` : "";
      const lines = f.text.split("\n").filter((l) => findPendingMarker(l)).map((l) => l.trim().replace(/^[-*]\s+/, ""));
      return `- **${where}**: ${lines.length > 0 ? lines.join(" / ") : f.text}${of}`;
    }),
    ...(frame.questions ?? []).map((q) => `- ${q.question}${q.proposal ? ` (${p.labels.proposal}: ${q.proposal})` : ""}`),
    // prd-pending and prd-questions are shown above in the owner's words
    ...frameFindings.filter((f) => !["prd-pending", "prd-questions"].includes(f.check)).map((f) => `- ${f.message}`),
    ...ucs.flatMap((uc) => irPending(uc.model).map((x) => `- **${uc.model.ir.name}: ${x.where}**: ${x.text}`)),
    ...ucs.flatMap((uc) => irQuestions(uc.model, frame, p).map((q) => `- **${uc.model.ir.name}**: ${q}`))
  ];
  const assumed = ucs.flatMap((uc) => (uc.model.ir.assumptions ?? []).map((a) => [a.id, a.question, a.proposal, a.basis]));
  if (questions.length === 0 && assumed.length === 0) return [p.labels.open_questions_none, ""];
  const out = [...questions, ""];
  if (assumed.length > 0) out.push(`**${p.labels.assumed}**`, "", ...table(p.labels.assumed_table, assumed), "");
  return out;
}
function renderQuestions(models, p = DEFAULT_PROFILE) {
  const frame = { users: [] };
  const ucs = models.map((model) => ({ file: "", model }));
  return [...openQuestions(frame, ucs, [], p), ""].join("\n");
}
function renderPrd(frame, ucs, frameFindings, p = DEFAULT_PROFILE) {
  const out = p.title ? [`# ${frame.title}`, "", `\`${frame.prd}\` \xB7 ${frame.status}${frame.owner ? ` \xB7 ${frame.owner}` : ""}`, ""] : [];
  const builtIn = new Set(BUILT_IN_SECTIONS);
  for (const s of p.sections) {
    const level = s.level ?? 2;
    if (s.id && !builtIn.has(s.id) && !s.required && !s.always && !nonEmptyString(frame.sections?.[s.id])) continue;
    out.push(`${"#".repeat(level)} ${s.heading}`, "");
    switch (s.id) {
      case void 0:
        break;
      case "summary":
        out.push(frame.summary, "");
        break;
      case "problem":
        out.push(...frame.problem.map((x) => `- ${x}`), "");
        break;
      case "users":
        out.push(...frame.users.map((u) => `- **${u.label ?? u.id}**: ${u.description}`), "");
        break;
      case "goals":
        out.push(...table(p.labels.goal_table, frame.goals.map((g) => [g.id, g.statement, g.metric, g.target ?? ""])), "");
        break;
      case "non_goals":
        out.push(...frame.non_goals.length > 0 ? frame.non_goals.map((x) => `- ${x}`) : ["-"], "");
        break;
      case "use_case_list":
        for (const { model } of ucs) {
          const critical = model.ir.scenarios.filter((sc) => sc.critical);
          out.push(`- ${model.ir.name}`, ...(critical.length > 0 ? critical : model.ir.scenarios).map((sc) => `  - ${sc.name}`));
        }
        out.push("");
        break;
      case "use_cases":
        for (const uc of ucs) out.push(...useCaseSection(uc, frame, p, level));
        break;
      case "open_questions":
        out.push(...openQuestions(frame, ucs, frameFindings, p));
        break;
      default:
        out.push(frame.sections?.[s.id] ?? (s.required ? "TBD" : ""), "");
    }
  }
  const text = out.join("\n").replace(/\s*ASSUMED\(([^)]+)\)/g, (_, id) => fill2(p.phrases.assumed, { id }));
  return `${text.replace(/\n{3,}/g, "\n\n").trimEnd()}
`;
}

// src/steps.ts
var import_yaml5 = __toESM(require_dist(), 1);
var SECTIONS = ["states", "givens", "events", "outcomes", "rules"];
function isRecord2(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
var isText = (v) => typeof v === "string" && v !== "";
function outcomeText(o) {
  return typeof o === "string" ? o : o.ui ?? o.observation ?? JSON.stringify(o);
}
function parseSteps(source) {
  const findings = [];
  const err = (message) => findings.push({ level: "error", check: "steps-schema", message });
  let raw;
  try {
    raw = (0, import_yaml5.parse)(source);
  } catch (e) {
    err(`cannot parse YAML: ${e.message}`);
    return { doc: void 0, findings };
  }
  if (!isRecord2(raw)) {
    err("the top level must be a map");
    return { doc: void 0, findings };
  }
  if (!isText(raw.steps)) err("steps must be a string holding the target usecase id");
  for (const key of Object.keys(raw)) {
    if (key !== "steps" && !SECTIONS.includes(key)) {
      err(`unknown key ${key} (allowed: steps, ${SECTIONS.join(", ")})`);
    }
  }
  for (const section of SECTIONS) {
    if (raw[section] !== void 0 && !isRecord2(raw[section])) err(`${section} must be a map`);
  }
  if (findings.length > 0) return { doc: void 0, findings };
  const entries = (section) => Object.entries(raw[section] ?? {});
  const exactlyOne = (at, v, keys) => {
    if (!isRecord2(v) || keys.filter((k) => isText(v[k])).length !== 1 || Object.keys(v).length !== 1) {
      err(`${at}: write exactly one of ${keys[0]}: <name> or ${keys[1]}: <name>`);
    }
  };
  for (const [id, v] of entries("states")) {
    if (!isRecord2(v) || !isText(v.fixture) || Object.keys(v).length !== 1) err(`states.${id}: write fixture: <name>`);
  }
  for (const [text, v] of entries("givens")) exactlyOne(`givens."${text}"`, v, ["state", "fixture"]);
  for (const [id, v] of entries("events")) exactlyOne(`events.${id}`, v, ["screen", "fixture"]);
  for (const [text, v] of entries("outcomes")) {
    const at = `outcomes."${text}"`;
    if (!isRecord2(v)) {
      err(`${at}: must be a map`);
    } else if ("unresolved" in v) {
      if (!isText(v.unresolved) || Object.keys(v).length !== 1) {
        err(`${at}: unresolved takes a non-empty reason and nothing else`);
      }
    } else if (!isText(v.expect)) {
      err(`${at}: write expect: <method> (with optional not / args), or unresolved: <reason>`);
    } else {
      const unknown = Object.keys(v).filter((k) => !["expect", "not", "args"].includes(k));
      if (unknown.length > 0) err(`${at}: unknown key ${unknown.join(", ")}`);
      if (v.not !== void 0 && !isText(v.not)) err(`${at}: not must be a method name`);
      if (v.args !== void 0 && !(Array.isArray(v.args) && v.args.every(isText))) {
        err(`${at}: args must be a list of strings`);
      }
    }
  }
  for (const [id, v] of entries("rules")) {
    const at = `rules.${id}`;
    if (!isRecord2(v) || !isRecord2(v.function) || !isText(v.function.name) || !isText(v.function.from)) {
      err(`${at}: write function: { name: <function>, from: <module> }`);
    } else if (!Array.isArray(v.cases) || !v.cases.every((c) => isRecord2(c) && Array.isArray(c.args) && "returns" in c)) {
      err(`${at}: cases must be a list of { args: [...], returns: ... }`);
    }
  }
  return { doc: raw, findings };
}
function universe(model) {
  const ir = model.ir;
  const outcomes = [];
  if (model.hasStateMachine) {
    for (const list of model.cells.values()) {
      for (const c of list) if (!c.impossible) outcomes.push(...(c.outcome ?? []).map(outcomeText));
    }
    for (const race of ir.races ?? []) outcomes.push(...race.outcome.map(outcomeText));
  } else {
    for (const sc of ir.scenarios) outcomes.push(...sc.then ?? []);
  }
  const startStates = model.hasStateMachine ? [model.initial ?? "", ...(ir.races ?? []).map((r) => r.state)].filter((s) => s !== "") : [];
  return {
    startStates: new Set(startStates),
    givens: new Set(ir.scenarios.flatMap((sc) => sc.given ?? [])),
    events: new Set(model.events.keys()),
    outcomes: new Set(outcomes),
    rules: new Map((ir.rules ?? []).map((r) => [r.id, r.cases.length]))
  };
}
function checkCoverage2(doc, model, findings) {
  const u = universe(model);
  const missing = (message) => findings.push({ level: "error", check: "steps-coverage", message });
  const stale = (at, what) => missing(`${at}: ${what} does not exist in the IR (a typo, or the IR changed \u2014 update or remove the definition)`);
  for (const s of u.startStates) {
    if (!doc.states?.[s]) missing(`state ${s} is a start state (the initial state or a race state) with no fixture in states`);
  }
  for (const s of Object.keys(doc.states ?? {})) if (!model.states.has(s)) stale(`states.${s}`, "the state");
  for (const g of u.givens) if (!doc.givens?.[g]) missing(`given "${g}" has no step definition`);
  for (const [g, def] of Object.entries(doc.givens ?? {})) {
    if (!u.givens.has(g)) {
      stale(`givens."${g}"`, "the given");
    } else if (def.state !== void 0) {
      if (!model.states.has(def.state)) {
        missing(`givens."${g}": state ${def.state} does not exist in the IR`);
      } else if (model.initial !== void 0 && def.state !== model.initial) {
        findings.push({
          level: "warn",
          check: "steps-given-state",
          message: `givens."${g}" describes ${def.state}, but every path starts at ${model.initial} \u2014 put it on the question list`
        });
      }
    }
  }
  for (const e of u.events) if (!doc.events?.[e]) missing(`event ${e} has no step definition`);
  for (const e of Object.keys(doc.events ?? {})) if (!u.events.has(e)) stale(`events.${e}`, "the event");
  for (const o of u.outcomes) if (!doc.outcomes?.[o]) missing(`outcome "${o}" has no step definition`);
  for (const [o, def] of Object.entries(doc.outcomes ?? {})) {
    if (!u.outcomes.has(o)) {
      stale(`outcomes."${o}"`, "the outcome");
    } else if (def.unresolved !== void 0) {
      findings.push({
        level: "warn",
        check: "steps-unresolved",
        message: `outcome "${o}" cannot be asserted yet: ${def.unresolved}`
      });
    }
  }
  for (const [id, count] of u.rules) {
    const def = doc.rules?.[id];
    if (!def) missing(`rule ${id} has no step definition`);
    else if (def.cases.length !== count) missing(`rules.${id}: the IR has ${count} cases, the step definitions ${def.cases.length}`);
  }
  for (const id of Object.keys(doc.rules ?? {})) if (!u.rules.has(id)) stale(`rules.${id}`, "the rule");
}
function runStepsChecks(doc, options = {}) {
  const findings = [];
  if (!options.model) return findings;
  if (doc.steps !== options.model.ir.usecase) {
    findings.push({
      level: "error",
      check: "steps-usecase",
      message: `the step definitions target (${doc.steps}) does not match the IR usecase (${options.model.ir.usecase})`
    });
    return findings;
  }
  checkCoverage2(doc, options.model, findings);
  return findings;
}

// src/paths.ts
function transitionCellsFrom(model, state) {
  const out = [];
  for (const list of model.cells.values()) {
    for (const c of list) {
      if (!c.impossible && c.from === state) out.push(c);
    }
  }
  return out;
}
function routeToUncovered(model, current2, covered) {
  const queue = [{ state: current2, events: [] }];
  const visited = /* @__PURE__ */ new Set([current2]);
  while (queue.length > 0) {
    const { state, events } = queue.shift();
    const hasUncovered = transitionCellsFrom(model, state).some(
      (c) => !covered.has(cellKey(c.from, c.on))
    );
    if (hasUncovered) return events;
    for (const c of transitionCellsFrom(model, state)) {
      if (c.to && !visited.has(c.to)) {
        visited.add(c.to);
        queue.push({ state: c.to, events: [...events, c.on] });
      }
    }
  }
  return void 0;
}
function suggestPaths(model) {
  if (!model.initial) return [];
  const covered = coveredCells(model);
  const uncoveredCount = () => {
    let n = 0;
    for (const list of model.cells.values()) {
      for (const c of list) {
        if (!c.impossible && !covered.has(cellKey(c.from, c.on))) n++;
      }
    }
    return n;
  };
  const suggestions = [];
  let guard = 0;
  while (uncoveredCount() > 0 && guard++ < 100) {
    const path = [];
    let current2 = model.initial;
    let progressed = false;
    for (let steps = 0; steps < 200; steps++) {
      const outgoing = transitionCellsFrom(model, current2);
      if (outgoing.length === 0) break;
      const uncoveredHere = outgoing.find((c) => !covered.has(cellKey(c.from, c.on)));
      if (uncoveredHere) {
        covered.add(cellKey(uncoveredHere.from, uncoveredHere.on));
        path.push(uncoveredHere.on);
        current2 = uncoveredHere.to;
        progressed = true;
        continue;
      }
      const route = routeToUncovered(model, current2, covered);
      if (!route || route.length === 0) break;
      for (const event of route) {
        const cell3 = model.cells.get(cellKey(current2, event))?.[0];
        if (!cell3 || cell3.impossible) break;
        path.push(event);
        current2 = cell3.to;
      }
    }
    if (!progressed) break;
    if (path.length > 0) suggestions.push(path);
  }
  return suggestions;
}

// src/trace.ts
var import_yaml6 = __toESM(require_dist(), 1);
var LAYERS = ["unit", "backend", "integration", "e2e"];
function testId(t) {
  return t.classname ? `${t.classname}#${t.name}` : t.name;
}
function isRecord3(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|lt|gt|amp|quot|apos);/g, (_, e) => {
    if (e === "lt") return "<";
    if (e === "gt") return ">";
    if (e === "amp") return "&";
    if (e === "quot") return '"';
    if (e === "apos") return "'";
    const code = e.startsWith("#x") ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return String.fromCodePoint(code);
  });
}
function parseAttributes(s) {
  const attrs = {};
  for (const m of s.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    attrs[m[1]] = decodeEntities(m[2] ?? m[3] ?? "");
  }
  return attrs;
}
function parseJUnit(xml, layer, source) {
  const results = [];
  const re = /<testcase\b((?:[^>"']|"[^"]*"|'[^']*')*?)(\/>|>([\s\S]*?)<\/testcase>)/g;
  for (const m of xml.matchAll(re)) {
    const attrs = parseAttributes(m[1] ?? "");
    const body = m[3] ?? "";
    const status = /<(failure|error)\b/.test(body) ? "Red" : /<skipped\b/.test(body) ? "Skip" : "Green";
    results.push({
      layer,
      source,
      classname: attrs["classname"] ?? "",
      name: attrs["name"] ?? "",
      status
    });
  }
  return results;
}
function parseGoTestJson(text, layer, source) {
  const results = [];
  const statusOf = { pass: "Green", fail: "Red", skip: "Skip" };
  for (const line of text.split("\n")) {
    if (!line.startsWith("{")) continue;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    const status = event.Action ? statusOf[event.Action] : void 0;
    if (!event.Test || !status) continue;
    results.push({ layer, source, classname: event.Package ?? "", name: event.Test, status });
  }
  return results;
}
var OUTCOME_MARKER = /\[ESDD-OUTCOME\]\s+(UC-[A-Z0-9-]+__[A-Za-z0-9_-]+)/g;
function parseOutcomeMarkers(text, layer, source) {
  const tags = /* @__PURE__ */ new Set();
  for (const m of text.matchAll(OUTCOME_MARKER)) tags.add(m[1]);
  return [...tags].map((tag) => ({
    layer,
    source,
    classname: "[ESDD-OUTCOME]",
    name: tag,
    status: "Green",
    marker: true
  }));
}
var TRACE_KEYS = ["trace", "untested", "owned_by", "negative_controls"];
function parseTrace(source) {
  const fail = (message) => ({
    doc: void 0,
    findings: [{ level: "error", check: "trace-schema", message }]
  });
  let raw;
  try {
    raw = (0, import_yaml6.parse)(source);
  } catch (e) {
    return fail(`cannot parse YAML: ${e.message}`);
  }
  if (!isRecord3(raw)) return fail("the top level must be a map");
  if (typeof raw["trace"] !== "string" || raw["trace"] === "") {
    return fail("trace (the target usecase id) is required");
  }
  const findings = [];
  for (const key of ["untested", "owned_by", "negative_controls"]) {
    if (raw[key] !== void 0 && raw[key] !== null && !isRecord3(raw[key])) {
      findings.push({
        level: "error",
        check: "trace-schema",
        message: `${key} must be a map (node \u2192 value)`
      });
    }
  }
  const unknown = Object.keys(raw).filter((k) => !TRACE_KEYS.includes(k));
  if (unknown.length > 0) {
    findings.push({
      level: "error",
      check: "trace-schema",
      message: `unknown keys: ${unknown.join(", ")} (only ${TRACE_KEYS.join(" / ")})`
    });
  }
  if (isRecord3(raw["negative_controls"])) {
    for (const [node, entry] of Object.entries(raw["negative_controls"])) {
      for (const problem of validateNcEntry(entry)) {
        findings.push({
          level: "error",
          check: "trace-schema",
          message: `negative_controls.${node}: ${problem}`
        });
      }
    }
  }
  if (findings.length > 0) return { doc: void 0, findings };
  return {
    doc: {
      trace: raw["trace"],
      untested: raw["untested"] ?? void 0,
      owned_by: raw["owned_by"] ?? void 0,
      negative_controls: raw["negative_controls"] ?? void 0
    },
    findings
  };
}
var NC_STATUSES = /* @__PURE__ */ new Set(["verified", "pending", "not-applicable"]);
var NC_CONTROL_REQUIRED = ["oracle", "breakage", "observed_failure", "verified"];
var DATE_PREFIX = /^\d{4}-\d{2}-\d{2}/;
function nonEmpty(v) {
  return typeof v === "string" && v.trim() !== "";
}
function validateNcEntry(entry) {
  if (!isRecord3(entry)) return ["write it as a map (status / controls / reason)"];
  const problems = [];
  const status = entry["status"];
  if (typeof status !== "string" || !NC_STATUSES.has(status)) {
    return [`status must be one of ${[...NC_STATUSES].join(" / ")}: ${JSON.stringify(status)}`];
  }
  const controls = entry["controls"];
  if (status === "verified") {
    if (!Array.isArray(controls) || controls.length === 0) {
      return ["status: verified needs at least one entry in controls"];
    }
    controls.forEach((c, i) => {
      if (!isRecord3(c)) {
        problems.push(`controls[${i}] must be a map`);
        return;
      }
      for (const key of NC_CONTROL_REQUIRED) {
        if (!nonEmpty(c[key])) problems.push(`controls[${i}].${key} is empty`);
      }
      if (nonEmpty(c["verified"]) && !DATE_PREFIX.test(c["verified"].trim())) {
        problems.push(`controls[${i}].verified must start with a date (YYYY-MM-DD)`);
      }
      if (c["layer"] !== void 0 && !LAYERS.includes(c["layer"])) {
        problems.push(`controls[${i}].layer must be one of ${LAYERS.join(" / ")}`);
      }
    });
  } else if (!nonEmpty(entry["reason"])) {
    problems.push(`status: ${status} needs a reason`);
  }
  return problems;
}
function collectScenarioControls(files) {
  const map = /* @__PURE__ */ new Map();
  for (const { path, text } of files) {
    let raw;
    try {
      raw = (0, import_yaml6.parse)(text);
    } catch {
      continue;
    }
    if (!isRecord3(raw) || !isRecord3(raw["negative_control"])) continue;
    const nc = raw["negative_control"];
    if (nc["status"] !== "verified" || !Array.isArray(nc["controls"])) continue;
    for (const c of nc["controls"]) {
      if (!isRecord3(c) || !Array.isArray(c["nodes"])) continue;
      for (const tag of c["nodes"]) {
        if (typeof tag !== "string") continue;
        const list = map.get(tag) ?? [];
        if (!list.some((e) => e.source === path)) list.push({ status: "verified", source: path });
        map.set(tag, list);
      }
    }
  }
  return map;
}
function transitionNodeId(from, on) {
  return `T-${from}-${on}`;
}
function ruleCaseNodeId(ruleId, index) {
  return `${ruleId}-c${index + 1}`;
}
function raceNodeId(state, between) {
  return `RACE-${state}-${between[0]}-${between[1]}`;
}
function outcomeNodeId(transitionId, index) {
  return `${transitionId}-o${index + 1}`;
}
function thenNodeId(scenarioId, index) {
  return `${scenarioId}-t${index + 1}`;
}
function raceOutcomeNodeId(raceId) {
  return `${raceId}-outcome`;
}
function formatOutcome(outcome) {
  return (outcome ?? []).map(
    (o) => typeof o === "string" ? o : [o.surface, o.ui ?? o.observation].filter(Boolean).join(": ")
  ).join(" / ");
}
function walkedCells(model, path) {
  const cells = [];
  if (!model.initial) return cells;
  let current2 = model.initial;
  for (const event of path) {
    const cell3 = model.cells.get(cellKey(current2, event))?.[0];
    if (!cell3 || cell3.impossible) break;
    cells.push(cellKey(current2, event));
    current2 = cell3.to;
  }
  return cells;
}
function toArray2(v) {
  if (v === void 0) return [];
  return Array.isArray(v) ? v : [v];
}
function enumerateNodes(model) {
  const nodes = [];
  const ir = model.ir;
  for (const sc of ir.scenarios ?? []) {
    nodes.push({
      id: sc.id,
      kind: "scenario",
      label: sc.name,
      critical: sc.critical === true,
      taggable: true,
      coveredBy: []
    });
    if (!model.hasStateMachine) {
      (sc.then ?? []).forEach((t, i) => {
        nodes.push({
          id: thenNodeId(sc.id, i),
          kind: "outcome",
          label: `${sc.id}: ${t}`,
          critical: sc.critical === true,
          taggable: true,
          coveredBy: []
        });
      });
    }
  }
  for (const rule of ir.rules ?? []) {
    rule.cases.forEach((c, i) => {
      const expected = typeof c.expected === "string" ? c.expected : JSON.stringify(c.expected);
      nodes.push({
        id: ruleCaseNodeId(rule.id, i),
        kind: "rule_case",
        label: `${rule.name}: ${JSON.stringify(c.input)} \u2192 ${expected}`,
        critical: false,
        taggable: true,
        coveredBy: []
      });
    });
  }
  if (model.hasStateMachine) {
    const walkers = /* @__PURE__ */ new Map();
    for (const sc of ir.scenarios ?? []) {
      for (const key of walkedCells(model, sc.path ?? [])) {
        walkers.set(key, [...walkers.get(key) ?? [], sc.id]);
      }
    }
    for (const list of model.cells.values()) {
      const c = list[0];
      if (model.states.get(c.from)?.terminal) continue;
      if (c.ignored) {
        nodes.push({
          id: transitionNodeId(c.from, c.on),
          kind: "ignored",
          label: `${c.from} \xD7 ${c.on} is ignored \u2014 ${c.reason}`,
          critical: false,
          taggable: true,
          coveredBy: []
        });
        continue;
      }
      if (c.impossible) continue;
      nodes.push({
        id: transitionNodeId(c.from, c.on),
        kind: "transition",
        label: `${c.from} \xD7 ${c.on} \u2192 ${c.to}`,
        critical: false,
        taggable: true,
        coveredBy: walkers.get(cellKey(c.from, c.on)) ?? []
      });
      (c.outcome ?? []).forEach((o, i) => {
        nodes.push({
          id: outcomeNodeId(transitionNodeId(c.from, c.on), i),
          kind: "outcome",
          label: `${c.from} \xD7 ${c.on}: ${formatOutcome([o])}`,
          critical: false,
          taggable: true,
          coveredBy: []
        });
      });
    }
    for (const r of ir.races ?? []) {
      const id = raceNodeId(r.state, r.between);
      nodes.push({
        id,
        kind: "race",
        label: `${r.state}: ${r.between.join(" vs ")} \u2192 ${raceWinnerText(r.winner)}`,
        critical: false,
        taggable: true,
        coveredBy: []
      });
      nodes.push({
        id: raceOutcomeNodeId(id),
        kind: "race_outcome",
        label: `${r.state}: what the losing side of ${r.between.join(" vs ")} sees \u2014 ${formatOutcome(r.outcome)}`,
        critical: false,
        taggable: true,
        coveredBy: []
      });
    }
  }
  const conds = inputConditions(model);
  const claimers = /* @__PURE__ */ new Map();
  const claim = (ref, nodeId) => {
    const key = ref.split("\xD7").map((s) => s.trim()).join("\xD7");
    claimers.set(key, [...claimers.get(key) ?? [], nodeId]);
  };
  for (const sc of ir.scenarios ?? []) {
    for (const ref of toArray2(sc.covers)) claim(ref, sc.id);
  }
  for (const rule of ir.rules ?? []) {
    rule.cases.forEach((c, i) => {
      for (const ref of toArray2(c.covers)) claim(ref, ruleCaseNodeId(rule.id, i));
    });
  }
  for (const inp of ir.inputs ?? []) {
    for (const cond of conds.get(inp.id) ?? []) {
      if (inp.na !== void 0 && cond in inp.na) continue;
      const id = `${inp.id}\xD7${cond}`;
      nodes.push({
        id,
        kind: "input_cell",
        label: id,
        critical: false,
        taggable: false,
        coveredBy: claimers.get(id) ?? []
      });
    }
  }
  return nodes;
}
var NODE_CONTINUATION = /[A-Za-z0-9-]/;
function extractTags(text, usecase, nodeIds) {
  const nodes = [];
  const unknown = [];
  const prefix = `${usecase}__`;
  let from = 0;
  for (; ; ) {
    const at = text.indexOf(prefix, from);
    if (at < 0) break;
    const before = at > 0 ? text[at - 1] : "";
    from = at + prefix.length;
    if (before !== "" && NODE_CONTINUATION.test(before)) continue;
    const rest = text.slice(from);
    let best;
    for (const id of nodeIds) {
      if (!rest.startsWith(id)) continue;
      const next = rest[id.length];
      if (next !== void 0 && NODE_CONTINUATION.test(next)) continue;
      if (best === void 0 || id.length > best.length) best = id;
    }
    if (best !== void 0) {
      nodes.push(best);
    } else {
      unknown.push(rest.match(/^[A-Za-z0-9-]*/)[0]);
    }
  }
  return { nodes, unknown };
}
var STATUS_RANK = { Green: 2, Red: 1, Skip: 0 };
function bestStatus(statuses) {
  let best;
  for (const s of statuses) {
    if (best === void 0 || STATUS_RANK[s] > STATUS_RANK[best]) best = s;
  }
  return best;
}
function nodeVerdict(statuses) {
  if (statuses.includes("Red")) return "Red";
  return bestStatus(statuses);
}
function runTrace(model, results, doc, scenarioControls = /* @__PURE__ */ new Map()) {
  const findings = [];
  const usecase = model.ir.usecase;
  const nodes = enumerateNodes(model);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const taggableIds = new Set(nodes.filter((n) => n.taggable).map((n) => n.id));
  if (doc && doc.trace !== usecase) {
    findings.push({
      level: "error",
      check: "trace-usecase",
      message: `the trace target (${doc.trace}) does not match the IR's usecase (${usecase})`
    });
    return { rows: [], findings };
  }
  const direct = /* @__PURE__ */ new Map();
  const attach = (nodeId, t) => {
    const list = direct.get(nodeId) ?? [];
    if (!list.includes(t)) list.push(t);
    direct.set(nodeId, list);
  };
  for (const t of results) {
    const { nodes: tagged, unknown } = extractTags(`${t.classname} ${t.name}`, usecase, taggableIds);
    for (const id of tagged) {
      if (t.marker && byId.get(id)?.kind !== "outcome") {
        findings.push({
          level: "error",
          check: "trace-tag",
          message: `${t.source} (${t.layer}): marker [ESDD-OUTCOME] ${usecase}__${id} is not an outcome node (print markers right after an outcome's assert; point at scenarios etc. with a test-name tag)`
        });
        continue;
      }
      attach(id, t);
    }
    for (const u of unknown) {
      findings.push({
        level: "error",
        check: "trace-tag",
        message: `${testId(t)} (${t.layer}): tag ${usecase}__${u} names no node in the IR (a typo, or a node removed from the IR; input cells cannot be tagged \u2014 tag the node that covers them)`
      });
    }
  }
  for (const [nodeId, refs] of Object.entries(doc?.owned_by ?? {})) {
    if (!byId.has(nodeId)) {
      findings.push({
        level: "error",
        check: "trace-owned-by",
        message: `owned_by.${nodeId}: no such node in the IR`
      });
      continue;
    }
    for (const ref of toArray2(refs)) {
      const hit = results.filter((t) => testId(t) === ref);
      if (hit.length === 0) {
        findings.push({
          level: "error",
          check: "trace-owned-by",
          message: `owned_by.${nodeId}: test ${ref} is not in the results (a test that did not run cannot own a node; pass its results with --results or check the ID)`
        });
      }
      for (const t of hit) attach(nodeId, t);
    }
  }
  const untested = doc?.untested ?? {};
  for (const [nodeId, reason] of Object.entries(untested)) {
    if (!byId.has(nodeId)) {
      findings.push({
        level: "error",
        check: "trace-untested",
        message: `untested.${nodeId}: no such node in the IR`
      });
    } else if (typeof reason !== "string" || reason.trim() === "") {
      findings.push({
        level: "error",
        check: "trace-untested",
        message: `untested.${nodeId}: a reason is required`
      });
    } else {
      const marker = findPendingMarker(reason);
      if (marker) {
        findings.push({
          level: "warn",
          check: "pending",
          message: `untested.${nodeId}: the reason still contains "${marker}"`
        });
      }
    }
  }
  const directVerdict = (nodeId) => nodeVerdict((direct.get(nodeId) ?? []).map((t) => t.status));
  const ruleIds = new Set((model.ir.rules ?? []).map((r) => r.id));
  const ncDoc = doc?.negative_controls ?? {};
  for (const key of Object.keys(ncDoc)) {
    if (!byId.has(key) && !ruleIds.has(key)) {
      findings.push({
        level: "error",
        check: "trace-nc",
        message: `negative_controls.${key}: no such node in the IR`
      });
    }
  }
  const tagPrefix = `${usecase}__`;
  for (const [tag, sources] of scenarioControls) {
    if (!tag.startsWith(tagPrefix)) continue;
    const key = tag.slice(tagPrefix.length);
    if (!byId.has(key) && !ruleIds.has(key)) {
      findings.push({
        level: "error",
        check: "trace-nc",
        message: `${sources.map((e) => e.source).join(", ")}: negative_control nodes entry ${tag} names no node in the IR`
      });
    }
  }
  const ncRecords = (n) => {
    const keys = [n.id];
    if (n.kind === "rule_case") keys.push(n.id.replace(/-c\d+$/, ""));
    const records = [];
    for (const key of keys) {
      const entry = ncDoc[key];
      if (entry) records.push({ status: entry.status, source: `trace.yaml (${key})` });
      records.push(...scenarioControls.get(`${tagPrefix}${key}`) ?? []);
    }
    return records;
  };
  const rows = [];
  for (const n of nodes) {
    const tests = direct.get(n.id) ?? [];
    const layers = {};
    for (const layer of LAYERS) {
      const s = nodeVerdict(tests.filter((t) => t.layer === layer).map((t) => t.status));
      if (s) layers[layer] = s;
    }
    const row = {
      node: n.id,
      kind: n.kind,
      label: n.label,
      critical: n.critical,
      verdict: "uncovered",
      layers,
      tests: tests.map(testId)
    };
    let verdict = directVerdict(n.id);
    if (verdict === void 0 && n.coveredBy.length > 0) {
      const viaStatuses = n.coveredBy.map((id) => [id, directVerdict(id)]).filter((e) => e[1] !== void 0);
      verdict = bestStatus(viaStatuses.map((e) => e[1]));
      if (verdict !== void 0) {
        row.via = viaStatuses.filter((e) => e[1] === verdict).map((e) => e[0]);
      }
    }
    const reason = typeof untested[n.id] === "string" ? untested[n.id] : void 0;
    if (verdict !== void 0) {
      row.verdict = verdict;
      if (reason !== void 0) {
        findings.push({
          level: "warn",
          check: "trace-untested",
          message: `untested.${n.id}: a test exists (${verdict}). The untested declaration may be stale \u2014 make the two agree`
        });
      }
      if (verdict !== "Green") {
        findings.push({
          level: "warn",
          check: "trace-failing",
          message: `${n.id} (${n.label}): tests exist but none is Green (${verdict})`
        });
      }
    } else if (reason !== void 0) {
      row.verdict = "untested";
      row.reason = reason;
    } else {
      findings.push({
        level: "error",
        check: "trace-uncovered",
        message: `${n.id} (${n.label}): not confirmed by a test at any layer. ` + (n.kind === "input_cell" ? "Run the tests of a node that covers it, or " : n.kind === "outcome" ? `Print [ESDD-OUTCOME] ${usecase}__${n.id} right after asserting this outcome (walking the path does not count as asserting it), point at an existing test with owned_by, or ` : `Put ${usecase}__${n.id} in a test name, point at an existing test with owned_by, or `) + "declare a reason under untested"
      });
    }
    const records = ncRecords(n);
    const ncRequired = n.kind !== "outcome" && directVerdict(n.id) === "Green";
    if (ncRequired || records.length > 0) {
      const statuses = records.map((r) => r.status);
      row.nc = statuses.includes("verified") ? "verified" : statuses.includes("not-applicable") ? "not-applicable" : statuses.includes("pending") ? "pending" : "missing";
      row.ncSources = [...new Set(records.map((r) => r.source))];
    }
    if (ncRequired && row.nc === "missing") {
      findings.push({
        level: "error",
        check: "trace-nc",
        message: `${n.id} (${n.label}): Green, but there is no negative control record (proof that the test fails when its oracle is broken). Add ${usecase}__${n.id} to negative_control.controls[].nodes in the scenario file (--scenarios), or record it under negative_controls in trace.yaml`
      });
    } else if (ncRequired && row.nc === "pending") {
      findings.push({
        level: "warn",
        check: "trace-nc",
        message: `${n.id} (${n.label}): the negative control is pending (no grounds yet to trust the Green)`
      });
    }
    if (n.kind === "race" || n.kind === "race_outcome") {
      const where = n.kind === "race" ? "a backend test (build the winner's state with a fixture; assert the loser's operation errors and the state is unchanged)" : "an integration test (the fake returns the loser's error; assert what is shown)";
      const provingLayers = n.kind === "race" ? ["unit", "backend"] : ["unit", "backend", "integration"];
      if (tests.length > 0 && !tests.some((t) => provingLayers.includes(t.layer))) {
        const why = n.kind === "race" ? "The winner is decided by the backend's mutual exclusion, which fake-server or E2E timing cannot confirm, so" : "E2E cannot create race timing deterministically, so";
        findings.push({
          level: "warn",
          check: "trace-race",
          message: `${n.id} (${n.label}): only confirmed at ${[...new Set(tests.map((t) => t.layer))].join(" / ")}. ${why} move it down to ${where}`
        });
      } else if (row.verdict === "untested") {
        findings.push({
          level: "warn",
          check: "trace-race",
          message: `${n.id} (${n.label}): untested. First check whether ${where} can create it deterministically, or whether an existing test already owns it (owned_by)`
        });
      }
    }
    if (n.critical && layers.e2e === void 0 && reason === void 0) {
      findings.push({
        level: "warn",
        check: "trace-critical",
        message: `${n.id} (${n.label}): critical, but there is no E2E result`
      });
    }
    rows.push(row);
  }
  return { rows, findings };
}
function cell2(s) {
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ");
}
function formatTraceTable(rows) {
  const lines = [
    "| node | kind | behavior | unit | backend | integration | e2e | verdict | NC |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |"
  ];
  for (const r of rows) {
    const verdict = r.verdict === "untested" ? `untested (${r.reason ?? ""})` : r.verdict === "uncovered" ? "**uncovered**" : r.via ? `${r.verdict} (via ${r.via.join(", ")})` : r.verdict;
    lines.push(
      `| ${r.node}${r.critical ? " (critical)" : ""} | ${r.kind} | ${cell2(r.label)} | ${r.layers.unit ?? ""} | ${r.layers.backend ?? ""} | ${r.layers.integration ?? ""} | ${r.layers.e2e ?? ""} | ${cell2(verdict)} | ${formatNc(r)} |`
    );
  }
  return lines.join("\n");
}
function formatNc(r) {
  if (r.nc === void 0) return "";
  return r.nc === "missing" ? "**missing**" : r.nc;
}
function traceSummary(rows) {
  const count = (v) => rows.filter((r) => r.verdict === v).length;
  const nc = (v) => rows.filter((r) => r.nc === v).length;
  return `behavior trace: ${rows.length} nodes \u2014 Green ${count("Green")} / Red ${count("Red")} / Skip ${count("Skip")} / untested ${count("untested")} / uncovered ${count("uncovered")} \u2014 NC verified ${nc("verified")} / pending ${nc("pending")} / not-applicable ${nc("not-applicable")} / missing ${nc("missing")}`;
}

// src/cli.ts
function resolveInput(p) {
  if (isAbsolute(p)) return p;
  return resolve(process.env["INIT_CWD"] ?? process.cwd(), p);
}
function parseArgs(argv) {
  const args = {
    files: [],
    bindings: [],
    steps: [],
    results: [],
    traces: [],
    suggest: false,
    json: false,
    strict: false,
    approved: false,
    digest: false,
    questions: false,
    render: false
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") {
      continue;
    }
    if (a === "--definitions") {
      args.definitions = argv[++i];
    } else if (a === "--bindings") {
      const p = argv[++i];
      if (p) args.bindings.push(p);
    } else if (a === "--steps") {
      const p = argv[++i];
      if (p) args.steps.push(p);
    } else if (a === "--results") {
      const v = argv[++i] ?? "";
      const eq = v.indexOf("=");
      const layer = v.slice(0, eq);
      if (eq < 0 || !LAYERS.includes(layer)) {
        console.error(`--results takes <${LAYERS.join("|")}>=<path>: ${v}`);
        process.exit(2);
      }
      args.results.push({ layer, path: v.slice(eq + 1) });
    } else if (a === "--scenarios") {
      args.scenarios = argv[++i];
    } else if (a === "--trace") {
      const p = argv[++i];
      if (p) args.traces.push(p);
    } else if (a === "--suggest-paths") {
      args.suggest = true;
    } else if (a === "--json") {
      args.json = true;
    } else if (a === "--strict") {
      args.strict = true;
    } else if (a === "--approved") {
      args.approved = true;
    } else if (a === "--digest") {
      args.digest = true;
    } else if (a === "--questions") {
      args.questions = true;
    } else if (a === "--prd") {
      args.prd = argv[++i];
    } else if (a === "--profile") {
      args.profile = argv[++i];
    } else if (a === "--render") {
      args.render = true;
    } else if (a === "--config") {
      args.config = argv[++i];
    } else if (a.startsWith("--")) {
      console.error(`unknown option: ${a}`);
      process.exit(2);
    } else {
      args.files.push(a);
    }
  }
  return args;
}
function collectFiles(path, exts) {
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((e) => {
    const child = join(path, e.name);
    if (e.isDirectory()) return collectFiles(child, exts);
    return exts.some((x) => e.name.endsWith(x)) ? [child] : [];
  });
}
function loadScenarioControls(dir) {
  let files;
  try {
    files = collectFiles(resolveInput(dir), [".yaml", ".yml"]);
  } catch (e) {
    console.error(`cannot read --scenarios ${dir}: ${e.message}`);
    process.exit(2);
  }
  return collectScenarioControls(files.map((f) => ({ path: f, text: readFileSync2(f, "utf8") })));
}
function loadResults(specs) {
  const results = [];
  for (const { layer, path } of specs) {
    let files;
    try {
      files = collectFiles(resolveInput(path), [".xml"]);
    } catch (e) {
      console.error(`cannot read --results ${path}: ${e.message}`);
      process.exit(2);
    }
    if (files.length === 0) {
      console.error(`--results contains no JUnit XML: ${path}`);
      process.exit(2);
    }
    for (const f of files) {
      const text = readFileSync2(f, "utf8");
      if (/\.jsonl?$/.test(f)) results.push(...parseGoTestJson(text, layer, f));
      else if (!/\.(log|txt)$/.test(f)) results.push(...parseJUnit(text, layer, f));
      results.push(...parseOutcomeMarkers(text, layer, f));
    }
  }
  return results;
}
function matrixStats(model) {
  const nonTerminal = [...model.states.values()].filter((s) => !s.terminal).length;
  const total = nonTerminal * model.events.size;
  let transitions = 0;
  let impossible = 0;
  let ignored = 0;
  for (const list of model.cells.values()) {
    for (const c of list) {
      if (model.states.get(c.from)?.terminal) continue;
      if (c.ignored) ignored++;
      else if (c.impossible) impossible++;
      else transitions++;
    }
  }
  return { total, transitions, impossible, ignored };
}
function coverageStats(model) {
  const covered = coveredCells(model);
  let total = 0;
  let hit = 0;
  for (const list of model.cells.values()) {
    for (const c of list) {
      if (c.impossible) continue;
      total++;
      if (covered.has(cellKey(c.from, c.on))) hit++;
    }
  }
  return { covered: hit, total };
}
function readOrExit(file) {
  try {
    return readFileSync2(resolveInput(file), "utf8");
  } catch (e) {
    console.error(`cannot read ${file}: ${e.message}`);
    process.exit(2);
  }
}
function runPrd(args, framePath) {
  const printFindings = (findings) => {
    for (const f of findings) console.log(`${f.level === "error" ? "ERROR" : "WARN "} [${f.check}] ${f.message}`);
  };
  const { frame, findings: frameParse } = parsePrd(readOrExit(framePath));
  if (!frame) {
    printFindings(frameParse);
    process.exit(args.render ? 2 : 1);
  }
  const dir = dirname(resolveInput(framePath));
  const linked = [];
  const irParse = [];
  for (const file of frame.usecases) {
    const { model, findings } = parseIR(readOrExit(resolve(dir, file)));
    irParse.push(...findings.map((f) => ({ ...f, message: `${file}: ${f.message}` })));
    if (model) linked.push({ file, model });
  }
  if (irParse.some((f) => f.level === "error")) {
    printFindings(irParse);
    process.exit(args.render ? 2 : 1);
  }
  const profile = mergeProfile(args.profile ? (0, import_yaml7.parse)(readOrExit(args.profile)) : void 0);
  const prdFindings = [...checkPrd(frame, linked.map((l) => l.model)), ...checkProfile(frame, profile)];
  if (args.approved && frame.status !== "approved") {
    prdFindings.push({ level: "error", check: "prd-approval", message: `${frame.prd}: status is ${frame.status}; a frame checked with --approved must be approved` });
  }
  if (args.render) {
    process.stdout.write(renderPrd(frame, linked, prdFindings, profile));
    return;
  }
  const all = [
    ...prdFindings,
    ...linked.flatMap((l) => runChecks(l.model).map((f) => ({ ...f, message: `${l.model.ir.usecase}: ${f.message}` })))
  ];
  if (frame.status === "approved") {
    for (const f of all.filter((x) => x.level === "warn")) f.level = "error";
  }
  printFindings(all);
  const errors = all.filter((f) => f.level === "error").length;
  const warns = all.length - errors;
  console.log(`${frame.prd}: ${errors} error(s), ${warns} warn(s) across ${linked.length} usecase(s)`);
  if (errors > 0 || args.strict && warns > 0) process.exit(1);
}
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.config) {
    try {
      const mod = await import(pathToFileURL(resolveInput(args.config)).href);
      configure(mod.default ?? {});
    } catch (e) {
      console.error(`cannot load --config ${args.config}: ${e.message}`);
      process.exit(2);
    }
  }
  if (args.prd) {
    runPrd(args, args.prd);
    return;
  }
  if (args.files.length === 0 && args.bindings.length === 0 && args.steps.length === 0) {
    console.error(
      "usage: node src/cli.ts <ir.yaml> [--definitions <path>] [--bindings <path>] [--steps <path>] [--suggest-paths] [--json] [--strict] [--approved] [--digest] [--questions [--profile <path>]] [--prd <frame> [--profile <path>] [--render]] [--results <layer>=<path> ...] [--trace <path>] [--scenarios <dir>] [--config <config.ts>]"
    );
    process.exit(2);
  }
  if (args.digest) {
    const pages = [];
    for (const file of args.files) {
      let source;
      try {
        source = readFileSync2(resolveInput(file), "utf8");
      } catch (e) {
        console.error(`cannot read: ${file}: ${e.message}`);
        process.exit(2);
      }
      const { model, findings } = parseIR(source);
      if (!model) {
        console.error(`cannot render a digest (the IR does not parse): ${file}: ${findings.map((f) => f.message).join(" / ")}`);
        process.exit(2);
      }
      pages.push(renderDigest(model));
    }
    process.stdout.write(pages.join("\n---\n\n"));
    return;
  }
  if (args.questions) {
    const models2 = [];
    for (const file of args.files) {
      let source;
      try {
        source = readFileSync2(resolveInput(file), "utf8");
      } catch (e) {
        console.error(`cannot read: ${file}: ${e.message}`);
        process.exit(2);
      }
      const { model, findings } = parseIR(source);
      if (!model) {
        console.error(`cannot list questions (the IR does not parse): ${file}: ${findings.map((f) => f.message).join(" / ")}`);
        process.exit(2);
      }
      models2.push(model);
    }
    process.stdout.write(renderQuestions(models2, mergeProfile(args.profile ? (0, import_yaml7.parse)(readOrExit(args.profile)) : void 0)));
    return;
  }
  if ((args.traces.length > 0 || args.scenarios) && args.results.length === 0) {
    console.error("--trace / --scenarios must be passed together with --results (the JUnit XML of the tests that ran)");
    process.exit(2);
  }
  const testResults = args.results.length > 0 ? loadResults(args.results) : void 0;
  const scenarioControls = args.scenarios ? loadScenarioControls(args.scenarios) : void 0;
  const traceDocs = /* @__PURE__ */ new Map();
  const traceFindings = [];
  for (const file of args.traces) {
    let source;
    try {
      source = readFileSync2(resolveInput(file), "utf8");
    } catch (e) {
      console.error(`cannot read ${file}: ${e.message}`);
      process.exit(2);
    }
    const { doc, findings } = parseTrace(source);
    traceFindings.push(...findings.map((f) => ({ ...f, message: `${file}: ${f.message}` })));
    if (doc) traceDocs.set(doc.trace, doc);
  }
  let observationNames;
  if (args.definitions) {
    try {
      observationNames = loadObservationNames(resolveInput(args.definitions));
    } catch (e) {
      console.error(`cannot load definitions: ${e.message}`);
      process.exit(2);
    }
  }
  let hasError = false;
  let hasWarn = false;
  const jsonOut = [];
  const models = /* @__PURE__ */ new Map();
  for (const file of args.files) {
    let source;
    try {
      source = readFileSync2(resolveInput(file), "utf8");
    } catch (e) {
      console.error(`cannot read ${file}: ${e.message}`);
      process.exit(2);
    }
    const { model, findings: parseFindings } = parseIR(source);
    let findings = [...parseFindings];
    let suggestions = [];
    let traceRows;
    if (model) {
      findings.push(...runChecks(model, { observationNames }));
      if (args.suggest) suggestions = suggestPaths(model);
      models.set(model.ir.usecase, model);
      if (testResults) {
        const trace = runTrace(model, testResults, traceDocs.get(model.ir.usecase), scenarioControls);
        findings.push(...trace.findings);
        traceRows = trace.rows;
      }
      if (args.approved) {
        findings = escalatePending(findings);
        findings.push(...checkApproved(model, file));
      }
    }
    const errors = findings.filter((f) => f.level === "error");
    const warns = findings.filter((f) => f.level === "warn");
    if (errors.length > 0) hasError = true;
    if (warns.length > 0) hasWarn = true;
    if (args.json) {
      jsonOut.push({
        file,
        ok: errors.length === 0,
        findings,
        suggestions: suggestions.length > 0 ? suggestions : void 0,
        trace: traceRows
      });
      continue;
    }
    console.log(`
=== ${file} ===`);
    if (model?.hasStateMachine) {
      const m = matrixStats(model);
      const cov = coverageStats(model);
      console.log(
        `state machine: states=${model.states.size} events=${model.events.size} cells ${m.transitions + m.impossible + m.ignored}/${m.total} declared (transitions ${m.transitions} / impossible ${m.impossible}` + (m.ignored > 0 ? ` / ignored ${m.ignored}` : "") + ")"
      );
      console.log(`transition coverage: ${cov.covered}/${cov.total} exercised by scenarios`);
    }
    if (model && (model.ir.inputs?.length ?? 0) > 0) {
      const conds = inputConditions(model);
      let totalCells = 0;
      let naCells = 0;
      for (const inp of model.ir.inputs) {
        const c = conds.get(inp.id) ?? [];
        totalCells += c.length;
        naCells += Object.keys(inp.na ?? {}).filter((k) => c.includes(k)).length;
      }
      console.log(
        `inputs: ${model.ir.inputs.length} inputs, ${totalCells} cells (${naCells} declared na)`
      );
    }
    for (const f of errors) console.log(`  ERROR [${f.check}] ${f.message}`);
    for (const f of warns) console.log(`  WARN  [${f.check}] ${f.message}`);
    if (errors.length === 0 && warns.length === 0) {
      console.log("  \u2713 all checks passed");
    } else {
      console.log(`  \u2192 ERROR ${errors.length} / WARN ${warns.length}`);
    }
    if (suggestions.length > 0) {
      console.log("  suggested paths for uncovered transitions:");
      suggestions.forEach((p, i) => console.log(`    path ${i + 1}: [${p.join(", ")}]`));
    }
    if (traceRows) {
      console.log(`
${traceSummary(traceRows)}
`);
      console.log(formatTraceTable(traceRows));
    }
  }
  for (const id of traceDocs.keys()) {
    if (!models.has(id)) {
      traceFindings.push({
        level: "error",
        check: "trace-usecase",
        message: `the IR of the trace target usecase ${id} is not among the inputs`
      });
    }
  }
  if (traceFindings.length > 0) {
    hasError ||= traceFindings.some((f) => f.level === "error");
    hasWarn ||= traceFindings.some((f) => f.level === "warn");
    if (args.json) {
      jsonOut.push({
        file: "(trace)",
        ok: !traceFindings.some((f) => f.level === "error"),
        findings: traceFindings
      });
    } else {
      console.log("\n=== trace ===");
      for (const f of traceFindings) {
        console.log(`  ${f.level === "error" ? "ERROR" : "WARN "} [${f.check}] ${f.message}`);
      }
    }
  }
  for (const file of args.bindings) {
    let source;
    try {
      source = readFileSync2(resolveInput(file), "utf8");
    } catch (e) {
      console.error(`cannot read ${file}: ${e.message}`);
      process.exit(2);
    }
    const { doc, findings: parseFindings } = parseBindings(source);
    const findings = [...parseFindings];
    let matched;
    if (doc) {
      const model = models.get(doc.bindings);
      if (model) {
        matched = doc.bindings;
      } else if (args.files.length > 0) {
        findings.push({
          level: "error",
          check: "bindings-usecase",
          message: `the IR of the target usecase ${doc.bindings} is not among the inputs (pass the corresponding IR alongside)`
        });
      }
      findings.push(...runBindingsChecks(doc, { model }));
    }
    const errors = findings.filter((f) => f.level === "error");
    const warns = findings.filter((f) => f.level === "warn");
    if (errors.length > 0) hasError = true;
    if (warns.length > 0) hasWarn = true;
    if (args.json) {
      jsonOut.push({ file, ok: errors.length === 0, findings });
      continue;
    }
    console.log(`
=== ${file} (bindings) ===`);
    if (doc) {
      const stats = [
        `elements ${Object.keys(doc.elements).length}`,
        doc.events ? `events ${Object.keys(doc.events).length}` : void 0,
        doc.literals ? `literals ${Object.keys(doc.literals).length}` : void 0,
        matched ? `IR cross-check: ${matched}` : "IR cross-check: none"
      ].filter((s) => s !== void 0);
      console.log(`bindings: ${stats.join(" / ")}`);
    }
    for (const f of errors) console.log(`  ERROR [${f.check}] ${f.message}`);
    for (const f of warns) console.log(`  WARN  [${f.check}] ${f.message}`);
    if (errors.length === 0 && warns.length === 0) {
      console.log("  \u2713 all checks passed");
    } else {
      console.log(`  \u2192 ERROR ${errors.length} / WARN ${warns.length}`);
    }
  }
  for (const file of args.steps) {
    let source;
    try {
      source = readFileSync2(resolveInput(file), "utf8");
    } catch (e) {
      console.error(`cannot read ${file}: ${e.message}`);
      process.exit(2);
    }
    const { doc, findings: parseFindings } = parseSteps(source);
    const findings = [...parseFindings];
    const model = doc ? models.get(doc.steps) : void 0;
    if (doc) {
      if (!model && args.files.length > 0) {
        findings.push({
          level: "error",
          check: "steps-usecase",
          message: `the IR of the target usecase ${doc.steps} is not among the inputs (pass the corresponding IR alongside)`
        });
      }
      findings.push(...runStepsChecks(doc, { model }));
    }
    const errors = findings.filter((f) => f.level === "error");
    const warns = findings.filter((f) => f.level === "warn");
    if (errors.length > 0) hasError = true;
    if (warns.length > 0) hasWarn = true;
    if (args.json) {
      jsonOut.push({ file, ok: errors.length === 0, findings });
      continue;
    }
    console.log(`
=== ${file} (steps) ===`);
    if (doc) {
      const counts = ["states", "givens", "events", "outcomes", "rules"].map((k) => `${k} ${Object.keys(doc[k] ?? {}).length}`).join(" / ");
      console.log(`steps: ${counts} / IR cross-check: ${model ? doc.steps : "none"}`);
    }
    for (const f of errors) console.log(`  ERROR [${f.check}] ${f.message}`);
    for (const f of warns) console.log(`  WARN  [${f.check}] ${f.message}`);
    if (errors.length === 0 && warns.length === 0) {
      console.log("  \u2713 all checks passed");
    } else {
      console.log(`  \u2192 ERROR ${errors.length} / WARN ${warns.length}`);
    }
  }
  if (args.json) console.log(JSON.stringify(jsonOut, null, 2));
  process.exit(hasError || args.strict && hasWarn ? 1 : 0);
}
await main();
