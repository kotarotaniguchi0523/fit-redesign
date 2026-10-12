// node_modules/@remix-run/component/dist/runtime/core/vnode.js
function createRemixElement(type, props, key) {
  return {
    $rmx: true,
    key,
    props: normalizeElementProps(props),
    type
  };
}
function isRemixElement(node) {
  if (typeof node !== "object" || node === null)
    return false;
  let type = Reflect.get(node, "type");
  let props = Reflect.get(node, "props");
  return Reflect.get(node, "$rmx") === true && (typeof type === "string" || typeof type === "function") && typeof props === "object" && props !== null;
}
function normalizeElementProps(props) {
  if (!props)
    return {};
  if (!("mix" in props))
    return props;
  if (isNormalizedMix(props.mix))
    return props;
  let { mix, ...rest } = props;
  let normalizedMix = normalizeMixValue(mix);
  return normalizedMix === void 0 ? rest : { ...rest, mix: normalizedMix };
}
function isNormalizedMix(mix) {
  if (!Array.isArray(mix) || mix.length === 0)
    return false;
  for (let i = 0; i < mix.length; i++) {
    let item = mix[i];
    if (!item || Array.isArray(item))
      return false;
  }
  return true;
}
function normalizeMixValue(mix) {
  if (!mix)
    return void 0;
  let normalizedMix = [];
  flattenMixValue(mix, normalizedMix);
  return normalizedMix.length === 0 ? void 0 : normalizedMix;
}
function flattenMixValue(mix, out) {
  if (!mix)
    return;
  if (!Array.isArray(mix)) {
    out.push(mix);
    return;
  }
  for (let item of mix) {
    flattenMixValue(item, out);
  }
}

// node_modules/@remix-run/component/dist/runtime/jsx.js
function jsx(type, props, key) {
  return createRemixElement(type, props, key);
}

// node_modules/@remix-run/component/dist/runtime/typed-event-target.js
var TypedEventTarget = class extends EventTarget {
};

// node_modules/@remix-run/component/dist/runtime/component.js
function createComponent(config) {
  return new ComponentRuntime(config);
}
var ComponentRuntime = class {
  frame;
  #config;
  #connectedController;
  #contextValue;
  #handle;
  #props = {};
  #renderController;
  #renderFn;
  #removed = false;
  #phase = "idle";
  // The schedule target is stored as fields (updated each render) rather than
  // a closure so re-renders don't allocate a new function per component.
  #updateQueue;
  #updateVNode;
  #updateDomParent;
  #scheduleUpdate = () => {
    let queue = this.#updateQueue;
    if (!queue)
      throw new Error("scheduleUpdate not implemented");
    let vnode = this.#updateVNode;
    let domParent = this.#updateDomParent;
    if (!vnode || !domParent)
      throw new Error("scheduleUpdate target not initialized");
    queue.enqueue(vnode, domParent);
  };
  #tasks = [];
  constructor(config) {
    this.#config = config;
    this.frame = config.frame;
    this.#handle = this.#createHandle();
  }
  render = (nextProps) => {
    if (this.#removed) {
      console.warn("render called after component was removed, potential application memory leak");
      return [null, []];
    }
    this.#abortRenderSignal();
    syncProps(this.#props, nextProps);
    let renderFn = this.#renderFn;
    if (renderFn === void 0) {
      let initialize = this.#config.type;
      let result;
      this.#phase = "setup";
      try {
        result = initialize(this.#handle);
      } finally {
        this.#phase = "idle";
      }
      if (!isRenderFn(result)) {
        let name = this.#config.type.name || "Anonymous";
        throw new Error(`${name} must return a render function, received ${typeof result}`);
      }
      renderFn = result;
      this.#renderFn = renderFn;
    }
    let element;
    this.#phase = "render";
    try {
      element = renderFn();
    } finally {
      this.#phase = "idle";
    }
    return [element, this.#dequeueTasks()];
  };
  remove = () => {
    if (this.#removed)
      return EMPTY_TASKS;
    this.#removed = true;
    this.#connectedController?.abort();
    this.#abortRenderSignal();
    if (this.#tasks.length === 0)
      return EMPTY_TASKS;
    return this.#dequeueTasks(sharedAbortedSignal ??= AbortSignal.abort());
  };
  setScheduleUpdate = (queue, vnode, domParent) => {
    this.#updateQueue = queue;
    this.#updateVNode = vnode;
    this.#updateDomParent = domParent;
  };
  getContextValue = () => this.#contextValue;
  isRemoved = () => this.#removed;
  #createHandle() {
    let component = this;
    let context = {
      set: (value) => {
        this.#contextValue = value;
      },
      get: (type) => isElementFunction(type) ? this.#config.getContext(type) : void 0
    };
    return {
      id: this.#config.id,
      props: this.#props,
      update: () => {
        if (component.#removed)
          return Promise.resolve(AbortSignal.abort());
        let name = component.#config.type.name || "Anonymous";
        if (component.#phase === "setup") {
          console.warn(`Ignored handle.update() while ${name} is running its setup function. The initial render includes setup changes.`);
          return new Promise((resolve) => {
            this.#tasks.push((signal) => resolve(signal));
          });
        }
        if (component.#phase !== "idle") {
          throw new Error(`Cannot call handle.update() while ${name} is running its ${component.#phase} function. Call it from an event handler or handle.queueTask() instead.`);
        }
        if (component.#updateQueue === void 0) {
          throw new Error(`Cannot call handle.update() before ${name}'s initial render commits. Call it from an event handler or handle.queueTask() instead.`);
        }
        return new Promise((resolve) => {
          this.#tasks.push((signal) => resolve(signal));
          this.#scheduleUpdate();
        });
      },
      queueTask: (task) => {
        this.#tasks.push(task);
      },
      frame: this.#config.frame,
      frames: {
        get top() {
          return component.#config.getTopFrame?.() ?? component.#config.frame;
        },
        get(name) {
          return component.#config.getFrameByName(name);
        }
      },
      context,
      get signal() {
        return component.#config.signal ?? component.#connectedSignal();
      }
    };
  }
  #connectedSignal() {
    this.#connectedController ??= new AbortController();
    return this.#connectedController.signal;
  }
  #abortRenderSignal() {
    this.#renderController?.abort();
    this.#renderController = void 0;
  }
  #dequeueTasks(signal) {
    if (this.#tasks.length === 0)
      return EMPTY_TASKS;
    let needsSignal = signal === void 0 && this.#tasks.some((task) => task.length >= 1);
    if (needsSignal) {
      this.#renderController ??= new AbortController();
    }
    signal ??= this.#renderController?.signal;
    signal ??= sharedAbortedSignal ??= AbortSignal.abort();
    let tasks = this.#tasks.splice(0, this.#tasks.length);
    return tasks.map((task) => () => task(signal));
  }
};
function isRenderFn(value) {
  return typeof value === "function";
}
function isElementFunction(value) {
  return typeof value === "function";
}
var EMPTY_TASKS = [];
var sharedAbortedSignal;
function syncProps(target, next) {
  for (let key in target) {
    if (!(key in next)) {
      delete target[key];
    }
  }
  for (let key in next) {
    target[key] = next[key];
  }
}
function Frame(handle) {
  void handle;
  return () => null;
}
function Fragment(handle) {
  void handle;
  return () => null;
}
function createFrameHandle(def) {
  return Object.assign(new TypedEventTarget(), {
    src: "/",
    replace: notImplemented("replace not implemented"),
    reload: notImplemented("reload not implemented")
  }, def);
}
function notImplemented(msg) {
  return () => {
    throw new Error(msg);
  };
}

// node_modules/@remix-run/component/dist/runtime/error-event.js
function createComponentErrorEvent(error) {
  return new ErrorEvent("error", { error });
}
function getComponentError(event) {
  return event.error;
}

// node_modules/@remix-run/component/dist/runtime/invariant.js
function invariant(assertion, message) {
  let prefix = "Framework invariant";
  if (assertion)
    return;
  throw new Error(message ? `${prefix}: ${message}` : prefix);
}

// node_modules/@remix-run/component/dist/runtime/document-state.js
function createDocumentState(_doc) {
  let doc = _doc ?? document;
  function getActiveElement() {
    return doc.activeElement || doc.body;
  }
  function hasSelectionCapabilities(elem) {
    let nodeName = elem.nodeName.toLowerCase();
    return nodeName === "input" && "type" in elem && (elem.type === "text" || elem.type === "search" || elem.type === "tel" || elem.type === "url" || elem.type === "password") || nodeName === "textarea" || elem instanceof HTMLElement && elem.contentEditable === "true";
  }
  function getSelection(input) {
    if ("selectionStart" in input && typeof input.selectionStart === "number" && "selectionEnd" in input) {
      let htmlInput = input;
      return {
        start: htmlInput.selectionStart ?? 0,
        end: htmlInput.selectionEnd ?? htmlInput.selectionStart ?? 0
      };
    }
    return null;
  }
  function setSelection(input, offsets) {
    if ("selectionStart" in input && "selectionEnd" in input) {
      try {
        let htmlInput = input;
        htmlInput.selectionStart = offsets.start;
        htmlInput.selectionEnd = Math.min(offsets.end, htmlInput.value?.length ?? 0);
      } catch {
      }
    }
  }
  function isInDocument(node) {
    return doc.documentElement.contains(node);
  }
  function getSelectionInformation() {
    let focusedElem = getActiveElement();
    return {
      focusedElem,
      selectionRange: focusedElem && hasSelectionCapabilities(focusedElem) ? getSelection(focusedElem) : null
    };
  }
  function restoreSelection(priorSelectionInformation) {
    let curFocusedElem = getActiveElement();
    let priorFocusedElem = priorSelectionInformation.focusedElem;
    let priorSelectionRange = priorSelectionInformation.selectionRange;
    if (curFocusedElem !== priorFocusedElem && priorFocusedElem && isInDocument(priorFocusedElem)) {
      let ancestors = [];
      let ancestor = priorFocusedElem;
      while (ancestor) {
        if (ancestor.nodeType === Node.ELEMENT_NODE) {
          let el = ancestor;
          ancestors.push({
            element: el,
            left: el.scrollLeft ?? 0,
            top: el.scrollTop ?? 0
          });
        }
        ancestor = ancestor.parentNode;
      }
      if (priorSelectionRange !== null && hasSelectionCapabilities(priorFocusedElem)) {
        setSelection(priorFocusedElem, priorSelectionRange);
      }
      if (priorFocusedElem instanceof HTMLElement && typeof priorFocusedElem.focus === "function") {
        priorFocusedElem.focus();
      }
      for (let info of ancestors) {
        info.element.scrollLeft = info.left;
        info.element.scrollTop = info.top;
      }
    }
  }
  let selectionInfo = null;
  function capture() {
    selectionInfo = getSelectionInformation();
  }
  function restore() {
    if (selectionInfo !== null) {
      restoreSelection(selectionInfo);
    }
    selectionInfo = null;
  }
  return { capture, restore };
}

// node_modules/@remix-run/component/dist/runtime/vnode.js
var TEXT_NODE = /* @__PURE__ */ Symbol("TEXT_NODE");
var NON_RENDER_NODE = /* @__PURE__ */ Symbol("NON_RENDER_NODE");
var ROOT_VNODE = /* @__PURE__ */ Symbol("ROOT_VNODE");
function isFragmentNode(node) {
  return node.kind === "fragment";
}
function isCommittedTextNode(node) {
  return node.kind === "text";
}
function isHostNode(node) {
  return node.kind === "host";
}
function isCommittedHostNode(node) {
  return node.kind === "host";
}
function isCommittedComponentNode(node) {
  return node.kind === "component" && "_content" in node;
}
function isCommittedClientEntryNode(node) {
  return node.kind === "client-entry";
}
function findContextFromAncestry(node, type) {
  let current = node;
  while (current) {
    if (current.kind === "component" && current.type === type) {
      return current._handle.getContextValue();
    }
    if (current.kind === "root") {
      return current._getContext?.(type);
    }
    current = "_parent" in current ? current._parent : void 0;
  }
  return void 0;
}

// node_modules/@remix-run/component/dist/runtime/spa-response.js
var spaResponses;
function getSpaResponseData(response) {
  return spaResponses?.get(response);
}

// node_modules/@remix-run/component/dist/runtime/frame-resolution.js
async function unwrapFrameResolution(resolution) {
  if (!(resolution instanceof Response))
    return { content: resolution };
  let data = getSpaResponseData(resolution);
  if (data) {
    return {
      content: data.node,
      redirectedTo: data.redirectedTo
    };
  }
  let content = resolution.body ?? await resolution.text();
  return {
    content,
    redirectedTo: resolution.redirected && resolution.url ? resolution.url : void 0
  };
}

// node_modules/@remix-run/component/dist/style/style.js
var CAMEL_TO_KEBAB_CACHE_LIMIT = 256;
var camelToKebabCache = /* @__PURE__ */ new Map();
function camelToKebab(str) {
  let cached = camelToKebabCache.get(str);
  if (cached === void 0) {
    cached = str.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    if (camelToKebabCache.size >= CAMEL_TO_KEBAB_CACHE_LIMIT) {
      let oldest = camelToKebabCache.keys().next();
      if (!oldest.done)
        camelToKebabCache.delete(oldest.value);
    }
    camelToKebabCache.set(str, cached);
  }
  return cached;
}
var NUMERIC_CSS_PROPS = /* @__PURE__ */ new Set([
  "aspect-ratio",
  "z-index",
  "opacity",
  "flex-grow",
  "flex-shrink",
  "flex-order",
  "grid-area",
  "grid-row",
  "grid-column",
  "font-weight",
  "line-height",
  "order",
  "orphans",
  "widows",
  "zoom",
  "columns",
  "column-count"
]);
function normalizeCssValue(key, value) {
  if (value == null)
    return String(value);
  if (typeof value === "number" && value !== 0) {
    let cssKey = camelToKebab(key);
    if (!NUMERIC_CSS_PROPS.has(cssKey) && !cssKey.startsWith("--")) {
      return `${value}px`;
    }
  }
  return String(value);
}

// node_modules/@remix-run/component/dist/runtime/svg-attributes.js
var XLINK_NS = "http://www.w3.org/1999/xlink";
var XML_NS = "http://www.w3.org/XML/1998/namespace";
var CANONICAL_CAMEL_SVG_ATTRS = /* @__PURE__ */ new Set([
  "accentHeight",
  "attributeName",
  "attributeType",
  "autoReverse",
  "baseFrequency",
  "baseProfile",
  "calcMode",
  "viewBox",
  "preserveAspectRatio",
  "externalResourcesRequired",
  "filterRes",
  "gradientUnits",
  "gradientTransform",
  "glyphRef",
  "kernelMatrix",
  "kernelUnitLength",
  "keyPoints",
  "keySplines",
  "keyTimes",
  "lengthAdjust",
  "limitingConeAngle",
  "markerHeight",
  "patternUnits",
  "patternContentUnits",
  "patternTransform",
  "markerWidth",
  "numOctaves",
  "pathLength",
  "pointsAtX",
  "pointsAtY",
  "pointsAtZ",
  "preserveAlpha",
  "clipPathUnits",
  "maskUnits",
  "maskContentUnits",
  "filterUnits",
  "primitiveUnits",
  "refX",
  "refY",
  "requiredExtensions",
  "requiredFeatures",
  "specularConstant",
  "specularExponent",
  "spreadMethod",
  "startOffset",
  "stdDeviation",
  "stitchTiles",
  "surfaceScale",
  "systemLanguage",
  "tableValues",
  "targetX",
  "targetY",
  "textLength",
  "viewTarget",
  "xChannelSelector",
  "yChannelSelector",
  "zoomAndPan",
  "edgeMode",
  "diffuseConstant",
  "markerUnits"
]);
var SVG_ATTR_ALIASES = /* @__PURE__ */ new Map();
for (let attr of CANONICAL_CAMEL_SVG_ATTRS) {
  SVG_ATTR_ALIASES.set(camelToKebab2(attr), attr);
}
var NAMESPACED_SVG_ALIASES = /* @__PURE__ */ new Map([
  ["xlinkHref", { ns: XLINK_NS, attr: "xlink:href" }],
  ["xlink:href", { ns: XLINK_NS, attr: "xlink:href" }],
  ["xlink-href", { ns: XLINK_NS, attr: "xlink:href" }],
  ["xlinkActuate", { ns: XLINK_NS, attr: "xlink:actuate" }],
  ["xlink:actuate", { ns: XLINK_NS, attr: "xlink:actuate" }],
  ["xlink-actuate", { ns: XLINK_NS, attr: "xlink:actuate" }],
  ["xlinkArcrole", { ns: XLINK_NS, attr: "xlink:arcrole" }],
  ["xlink:arcrole", { ns: XLINK_NS, attr: "xlink:arcrole" }],
  ["xlink-arcrole", { ns: XLINK_NS, attr: "xlink:arcrole" }],
  ["xlinkRole", { ns: XLINK_NS, attr: "xlink:role" }],
  ["xlink:role", { ns: XLINK_NS, attr: "xlink:role" }],
  ["xlink-role", { ns: XLINK_NS, attr: "xlink:role" }],
  ["xlinkShow", { ns: XLINK_NS, attr: "xlink:show" }],
  ["xlink:show", { ns: XLINK_NS, attr: "xlink:show" }],
  ["xlink-show", { ns: XLINK_NS, attr: "xlink:show" }],
  ["xlinkTitle", { ns: XLINK_NS, attr: "xlink:title" }],
  ["xlink:title", { ns: XLINK_NS, attr: "xlink:title" }],
  ["xlink-title", { ns: XLINK_NS, attr: "xlink:title" }],
  ["xlinkType", { ns: XLINK_NS, attr: "xlink:type" }],
  ["xlink:type", { ns: XLINK_NS, attr: "xlink:type" }],
  ["xlink-type", { ns: XLINK_NS, attr: "xlink:type" }],
  ["xmlBase", { ns: XML_NS, attr: "xml:base" }],
  ["xml:base", { ns: XML_NS, attr: "xml:base" }],
  ["xml-base", { ns: XML_NS, attr: "xml:base" }],
  ["xmlLang", { ns: XML_NS, attr: "xml:lang" }],
  ["xml:lang", { ns: XML_NS, attr: "xml:lang" }],
  ["xml-lang", { ns: XML_NS, attr: "xml:lang" }],
  ["xmlSpace", { ns: XML_NS, attr: "xml:space" }],
  ["xml:space", { ns: XML_NS, attr: "xml:space" }],
  ["xml-space", { ns: XML_NS, attr: "xml:space" }],
  ["xmlnsXlink", { attr: "xmlns:xlink" }],
  ["xmlns:xlink", { attr: "xmlns:xlink" }],
  ["xmlns-xlink", { attr: "xmlns:xlink" }]
]);
function normalizeSvgAttributeName(name) {
  let alias = SVG_ATTR_ALIASES.get(name);
  if (alias)
    return alias;
  if (CANONICAL_CAMEL_SVG_ATTRS.has(name))
    return name;
  return camelToKebab2(name);
}
function normalizeSvgAttribute(name) {
  let namespaced = NAMESPACED_SVG_ALIASES.get(name);
  if (namespaced) {
    return namespaced;
  }
  return { attr: normalizeSvgAttributeName(name) };
}
function camelToKebab2(input) {
  return input.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/_/g, "-").toLowerCase();
}

// node_modules/@remix-run/component/dist/runtime/core/attributes.js
var ATTRIBUTE_FALLBACK_NAMES = /* @__PURE__ */ new Set([
  "width",
  "height",
  "href",
  "list",
  "form",
  "tabIndex",
  "download",
  "rowSpan",
  "colSpan",
  "role",
  "popover",
  "translate"
]);
var BOOLEANISH_STRING_ATTRIBUTES = /* @__PURE__ */ new Set([
  "autoReverse",
  "contenteditable",
  "draggable",
  "externalResourcesRequired",
  "focusable",
  "preserveAlpha",
  "spellcheck"
]);
var BLOCKED_HOST_PROP_NAMES = /* @__PURE__ */ new Set(["__proto__", "outerHTML"]);
var INVALID_HOST_PROP_NAME_CHARACTER = /[\u0000\t\n\f\r "'/>=]/;
var EXECUTABLE_URL_ATTRIBUTES = /* @__PURE__ */ new Set(["href", "src", "action", "formaction", "xlink:href"]);
var JAVASCRIPT_PROTOCOL = /^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i;
var BLOCKED_JAVASCRIPT_URL = "javascript:throw new Error('Remix has blocked a javascript: URL as a security precaution.')";
function isAllowedHostPropName(name) {
  if (name.length === 0 || INVALID_HOST_PROP_NAME_CHARACTER.test(name))
    return false;
  let normalizedName = name.toLowerCase();
  return !normalizedName.startsWith("on") && !BLOCKED_HOST_PROP_NAMES.has(name);
}
function sanitizeUrlAttribute(tagName, attrName, value) {
  let isExecutableUrl = EXECUTABLE_URL_ATTRIBUTES.has(attrName) || attrName === "data" && tagName.toLowerCase() === "object";
  if (!isExecutableUrl)
    return value;
  return JAVASCRIPT_PROTOCOL.test(String(value)) ? BLOCKED_JAVASCRIPT_URL : value;
}
function canUseProperty(element, name, isSvg, attr) {
  if (isSvg)
    return false;
  if (ATTRIBUTE_FALLBACK_NAMES.has(name))
    return false;
  if (isBooleanishStringAttribute(attr))
    return false;
  return name in element;
}
var NORMALIZATION_CACHE_LIMIT = 256;
var htmlAttributeNameCache = /* @__PURE__ */ new Map();
var svgAttributeNameCache = /* @__PURE__ */ new Map();
function normalizeAttributeName(name, isSvg) {
  let cache = isSvg ? svgAttributeNameCache : htmlAttributeNameCache;
  let cached = cache.get(name);
  if (cached === void 0) {
    cached = computeAttributeName(name, isSvg);
    if (cache.size >= NORMALIZATION_CACHE_LIMIT) {
      let oldest = cache.keys().next();
      if (!oldest.done)
        cache.delete(oldest.value);
    }
    cache.set(name, cached);
  }
  return cached;
}
function computeAttributeName(name, isSvg) {
  if (name.startsWith("aria-") || name.startsWith("data-"))
    return { attr: name };
  if (name === "className")
    return { attr: "class" };
  if (!isSvg) {
    if (name === "htmlFor")
      return { attr: "for" };
    if (name === "tabIndex")
      return { attr: "tabindex" };
    if (name === "acceptCharset")
      return { attr: "accept-charset" };
    if (name === "httpEquiv")
      return { attr: "http-equiv" };
    return { attr: name.toLowerCase() };
  }
  return normalizeSvgAttribute(name);
}
function isBooleanishStringAttribute(name) {
  return BOOLEANISH_STRING_ATTRIBUTES.has(name);
}
function serializeStyleObject(style) {
  let parts = [];
  for (let [key, value] of Object.entries(style)) {
    if (value == null)
      continue;
    if (typeof value === "boolean")
      continue;
    if (typeof value === "number" && !Number.isFinite(value))
      continue;
    let cssKey = toKebabCase(key);
    let cssValue = Array.isArray(value) ? value.join(", ") : normalizeCssValue(key, value);
    parts.push(`${cssKey}: ${cssValue};`);
  }
  return parts.join(" ");
}
function getMergedClassName(props) {
  let classAttr = typeof props.class === "string" ? props.class : "";
  let className = typeof props.className === "string" ? props.className : "";
  let merged = classAttr && className ? `${classAttr} ${className}` : classAttr || className;
  return merged || void 0;
}
var kebabCaseCache = /* @__PURE__ */ new Map();
function toKebabCase(value) {
  let cached = kebabCaseCache.get(value);
  if (cached === void 0) {
    cached = value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
    if (kebabCaseCache.size >= NORMALIZATION_CACHE_LIMIT) {
      let oldest = kebabCaseCache.keys().next();
      if (!oldest.done)
        kebabCaseCache.delete(oldest.value);
    }
    kebabCaseCache.set(value, cached);
  }
  return cached;
}

// node_modules/@remix-run/component/dist/runtime/core/props.js
var SVG_NS = "http://www.w3.org/2000/svg";
function isFrameworkProp(name) {
  return name === "children" || name === "mix" || name === "key" || name === "animate" || name === "innerHTML" || name === "on";
}
function toLocalName(attrName) {
  let separatorIndex = attrName.indexOf(":");
  if (separatorIndex === -1)
    return attrName;
  return attrName.slice(separatorIndex + 1);
}
function clearRuntimePropertyOnRemoval(dom, name) {
  try {
    if (name === "value" || name === "defaultValue") {
      dom[name] = "";
      return;
    }
    if (name === "checked" || name === "defaultChecked" || name === "selected") {
      dom[name] = false;
      return;
    }
    if (name === "selectedIndex") {
      dom[name] = -1;
    }
  } catch {
  }
}
function patchHostProps(curr, next, dom) {
  let isSvg = dom.namespaceURI === SVG_NS;
  let currClassName = getMergedClassName(curr);
  let nextClassName = getMergedClassName(next);
  if (currClassName !== nextClassName) {
    if (nextClassName) {
      dom.setAttribute("class", nextClassName);
    } else {
      dom.removeAttribute("class");
    }
  }
  for (let name in curr) {
    if (isFrameworkProp(name))
      continue;
    if (!isAllowedHostPropName(name))
      continue;
    if (name === "class" || name === "className")
      continue;
    if (name in next && next[name] != null)
      continue;
    let { ns, attr } = normalizeAttributeName(name, isSvg);
    if (canUseProperty(dom, name, isSvg, attr)) {
      clearRuntimePropertyOnRemoval(dom, name);
    }
    if (ns)
      dom.removeAttributeNS(ns, toLocalName(attr));
    else
      dom.removeAttribute(attr);
  }
  for (let name in next) {
    if (isFrameworkProp(name))
      continue;
    if (!isAllowedHostPropName(name))
      continue;
    if (name === "class" || name === "className")
      continue;
    let nextValue = next[name];
    if (nextValue == null)
      continue;
    let prevValue = curr[name];
    if (prevValue === nextValue)
      continue;
    if (name === "style" && isStyleObject(nextValue)) {
      if (isStyleObject(prevValue)) {
        patchStyleObject(dom, prevValue, nextValue);
      } else {
        dom.removeAttribute("style");
        patchStyleObject(dom, void 0, nextValue);
      }
      continue;
    }
    patchHostProp(dom, name, nextValue, isSvg);
  }
}
function patchHostProp(dom, name, value, isSvg) {
  let { ns, attr } = normalizeAttributeName(name, isSvg);
  value = sanitizeUrlAttribute(dom.localName, attr, value);
  if (attr === "style" && isStyleObject(value)) {
    patchStyleObject(dom, void 0, value);
    return;
  }
  if (attr === "style" && typeof value === "string") {
    dom.setAttribute("style", value);
    return;
  }
  if (canUseProperty(dom, name, isSvg, attr)) {
    try {
      dom[name] = value == null ? "" : value;
      return;
    } catch {
    }
  }
  if (typeof value === "function")
    return;
  let isAriaOrData = name.startsWith("aria-") || name.startsWith("data-");
  let isBooleanishString = isBooleanishStringAttribute(attr);
  if (value != null && (value !== false || isAriaOrData || isBooleanishString)) {
    let attrValue = name === "popover" && value === true ? "" : String(value);
    if (ns)
      dom.setAttributeNS(ns, attr, attrValue);
    else
      dom.setAttribute(attr, attrValue);
  } else {
    if (ns)
      dom.removeAttributeNS(ns, toLocalName(attr));
    else
      dom.removeAttribute(attr);
  }
}
function isStyleObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function patchStyleObject(dom, curr, next) {
  if (!(dom instanceof HTMLElement || dom instanceof SVGElement)) {
    dom.setAttribute("style", serializeStyleObject(next));
    return;
  }
  let style = dom.style;
  if (curr) {
    for (let name in curr) {
      let nextCssValue = styleValueToCss(name, next[name]);
      if (nextCssValue !== void 0)
        continue;
      let prevCssValue = styleValueToCss(name, curr[name]);
      if (prevCssValue === void 0)
        continue;
      style.removeProperty(toKebabCase(name));
    }
  }
  for (let name in next) {
    let nextCssValue = styleValueToCss(name, next[name]);
    if (nextCssValue === void 0)
      continue;
    let prevCssValue = curr ? styleValueToCss(name, curr[name]) : void 0;
    if (prevCssValue === nextCssValue)
      continue;
    style.setProperty(toKebabCase(name), nextCssValue);
  }
}
function styleValueToCss(name, value) {
  if (value == null)
    return void 0;
  if (typeof value === "boolean")
    return void 0;
  if (typeof value === "number" && !Number.isFinite(value))
    return void 0;
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  return normalizeCssValue(name, value);
}

// node_modules/@remix-run/component/dist/runtime/client-entries.js
function isEntry(component) {
  return Boolean(component && typeof component === "function" && component.$entry === true);
}
function logHydrationMismatch(...msg) {
  console.error("Hydration mismatch:", ...msg);
}
function skipComments(cursor) {
  while (cursor && cursor.nodeType === Node.COMMENT_NODE) {
    cursor = cursor.nextSibling;
  }
  return cursor;
}

// node_modules/@remix-run/component/dist/runtime/core/children.js
function isEmptyChild(value) {
  return value == null || typeof value === "boolean";
}
function isPrimitiveChild(value) {
  let type = typeof value;
  return type === "string" || type === "number" || type === "bigint";
}
function normalizeChildren(children) {
  for (let i = 0; i < children.length; i++) {
    if (Array.isArray(children[i])) {
      return children.flat(Infinity);
    }
  }
  return children;
}
function isRemixNode(value) {
  if (value == null)
    return true;
  let type = typeof value;
  if (type === "string" || type === "number" || type === "bigint" || type === "boolean") {
    return true;
  }
  if (isRemixElement(value))
    return true;
  if (!Array.isArray(value))
    return false;
  for (let child of value) {
    if (!isRemixNode(child))
      return false;
  }
  return true;
}

// node_modules/@remix-run/component/dist/runtime/core/mix.js
var MAX_MIX_DESCRIPTORS = 1024;
function composeMixedProps(hostType, props, runDescriptor) {
  let descriptors = resolveMixDescriptors(props);
  let composedProps = withoutMix(props);
  let mixinProps = withoutMixinContentProps(composedProps);
  for (let index = 0; index < descriptors.length && index < MAX_MIX_DESCRIPTORS; index++) {
    let result = runDescriptor(descriptors[index], index, mixinProps);
    if (!result)
      continue;
    if (isMixinElementFunction(result))
      continue;
    let returnedDescriptors = resolveReturnedMixDescriptors(result);
    if (returnedDescriptors) {
      for (let returned of returnedDescriptors)
        descriptors.push(returned);
      continue;
    }
    if (!isRemixElementResult(result)) {
      console.error(new Error("mixins must return a remix element"));
      continue;
    }
    let resultType = typeof result.type === "string" ? result.type : isMixinElementFunction(result.type) ? result.type.__rmxMixinElementType : null;
    if (resultType !== hostType) {
      console.error(new Error("mixins must return an element with the same host type"));
      continue;
    }
    let nextProps = sanitizeReturnedMixinProps(result.props);
    for (let nested of resolveMixDescriptors(nextProps))
      descriptors.push(nested);
    composedProps = { ...composedProps, ...withoutMix(nextProps) };
    mixinProps = withoutMixinContentProps(composedProps);
  }
  let nextMix = props.mix;
  return {
    ...composedProps,
    ...nextMix === void 0 ? {} : { mix: nextMix }
  };
}
function resolveMixDescriptors(props) {
  let mix = props.mix;
  if (!mix)
    return [];
  if (Array.isArray(mix)) {
    if (mix.length === 0)
      return [];
    return mix.filter(Boolean);
  }
  return [mix];
}
function withoutMix(props) {
  if (!("mix" in props))
    return props;
  let output = { ...props };
  delete output.mix;
  return output;
}
function withoutMixinContentProps(props) {
  if (!hasMixinContentProps(props))
    return props;
  let output = { ...props };
  delete output.children;
  delete output.innerHTML;
  delete output.srcDoc;
  delete output.srcdoc;
  delete output.outerHTML;
  return output;
}
function sanitizeReturnedMixinProps(props) {
  if (!hasMixinContentProps(props))
    return props;
  console.error(new Error("mixins must not return children or raw HTML props"));
  return withoutMixinContentProps(props);
}
function hasMixinContentProps(props) {
  return "children" in props || "innerHTML" in props || "srcDoc" in props || "srcdoc" in props || "outerHTML" in props;
}
function isMixinDescriptor(value) {
  if (!value || typeof value !== "object" || isRemixElementResult(value)) {
    return false;
  }
  let descriptor = value;
  return typeof descriptor.type === "function" && Array.isArray(descriptor.args);
}
function isMixinElementFunction(value) {
  if (typeof value !== "function")
    return false;
  return "__rmxMixinElementType" in value;
}
function isRemixElementResult(value) {
  if (!value || typeof value !== "object")
    return false;
  return value.$rmx === true;
}
function resolveReturnedMixDescriptors(value) {
  let descriptors = [];
  if (!collectReturnedMixDescriptors(value, descriptors)) {
    return null;
  }
  return descriptors;
}
function collectReturnedMixDescriptors(value, output) {
  if (!value) {
    return true;
  }
  if (Array.isArray(value)) {
    for (let item of value) {
      if (!collectReturnedMixDescriptors(item, output)) {
        return false;
      }
    }
    return true;
  }
  if (!isMixinDescriptor(value)) {
    return false;
  }
  output.push(value);
  return true;
}

// node_modules/@remix-run/component/dist/runtime/unsafe-html.js
var UnsafeHTMLValue = class {
  #value;
  constructor(value) {
    this.#value = value;
  }
  static read(value) {
    return value.#value;
  }
};
function readUnsafeHTML(value) {
  return value instanceof UnsafeHTMLValue ? UnsafeHTMLValue.read(value) : void 0;
}
function normalizeUnsafeHTMLProps(props) {
  let innerHTML = readUnsafeHTML(props.innerHTML);
  invariant(props.innerHTML === void 0 || innerHTML !== void 0, "Invalid innerHTML prop");
  let srcDoc = readUnsafeHTML(props.srcDoc);
  invariant(props.srcDoc === void 0 || srcDoc !== void 0, "Invalid srcDoc prop");
  let srcdoc = readUnsafeHTML(props.srcdoc);
  invariant(props.srcdoc === void 0 || srcdoc !== void 0, "Invalid srcdoc prop");
  invariant(props.outerHTML === void 0, "Invalid outerHTML prop");
  if (innerHTML === void 0 && srcDoc === void 0 && srcdoc === void 0)
    return props;
  return {
    ...props,
    ...innerHTML === void 0 ? {} : { innerHTML },
    ...srcDoc === void 0 ? {} : { srcDoc },
    ...srcdoc === void 0 ? {} : { srcdoc }
  };
}

// node_modules/@remix-run/component/dist/runtime/to-vnode.js
function flatMapChildrenToVNodes(props) {
  let children = props.children;
  if (children === void 0)
    return [];
  if (!Array.isArray(children))
    return [toVNode(children)];
  let vnodes = [];
  flattenChildrenToVNodes(children, vnodes);
  return vnodes;
}
function flattenChildrenToVNodes(nodes, out) {
  let children = normalizeChildren(nodes);
  for (let i = 0; i < children.length; i++) {
    out.push(toVNode(children[i]));
  }
}
function toVNode(node) {
  if (isEmptyChild(node)) {
    return { kind: "empty", type: NON_RENDER_NODE };
  }
  if (isPrimitiveChild(node)) {
    return { kind: "text", type: TEXT_NODE, _text: String(node) };
  }
  if (isRemixElement(node)) {
    if (node.type === Fragment) {
      let props = parseHostProps(node.props);
      return {
        kind: "fragment",
        type: Fragment,
        key: node.key,
        _children: flatMapChildrenToVNodes(props)
      };
    }
    if (node.type === Frame) {
      invariant(isFrameProps(node.props), "<Frame /> requires a src prop");
      return { kind: "frame", type: Frame, key: node.key, props: node.props };
    }
    if (typeof node.type === "string") {
      let props = parseHostProps(node.props);
      let children = props.innerHTML != null ? [] : flatMapChildrenToVNodes(props);
      return {
        kind: "host",
        type: node.type,
        key: node.key,
        props,
        _children: children
      };
    }
    invariant(isElementFunction2(node.type), "Expected component element type");
    return { kind: "component", type: node.type, key: node.key, props: node.props };
  }
  if (Array.isArray(node)) {
    let children = [];
    flattenChildrenToVNodes(node, children);
    return { kind: "fragment", type: Fragment, _children: children };
  }
  invariant(false, "Unexpected RemixNode");
}
function isFrameProps(props) {
  return typeof props.src === "string" && props.src.length > 0;
}
function parseHostProps(props) {
  let normalizedProps = normalizeUnsafeHTMLProps(props);
  let children = normalizedProps.children;
  invariant(children === void 0 || isRemixNode(children), "Invalid host children");
  let mix = normalizedProps.mix;
  invariant(mix === void 0 || isRuntimeMixValue(mix), "Invalid mix prop");
  return normalizedProps;
}
function isRuntimeMixValue(value) {
  if (!Array.isArray(value))
    return isMixinDescriptor(value);
  for (let descriptor of value) {
    if (!isMixinDescriptor(descriptor))
      return false;
  }
  return true;
}
function isElementFunction2(value) {
  return typeof value === "function";
}

// node_modules/@remix-run/component/dist/runtime/mixins/mixin.js
var mixinHandleId = 0;
function createMixin(type) {
  return (...args) => ({
    type,
    args
  });
}
function resolveMixedProps(input) {
  let state = input.state ?? createMixinRuntimeState();
  let scopedHandle = state.handle;
  if (!scopedHandle) {
    scopedHandle = createMixinHandle({
      id: state.id,
      hostType: input.hostType,
      frame: input.frame,
      scheduler: input.scheduler,
      getContext: input.getContext ?? (() => void 0),
      getRuntimeSignal: () => getMixinRuntimeSignal(state),
      getBinding: () => state.binding
    });
    state.handle = scopedHandle;
  }
  let handle = scopedHandle;
  let hostType = input.hostType;
  let runnerCount = 0;
  let props = composeMixedProps(hostType, input.props, (descriptor, index, mixinProps) => {
    runnerCount = index + 1;
    let entry = state.runners[index];
    if (!entry || entry.type !== descriptor.type) {
      if (entry) {
        queueMixinRemove(handle, entry.scope);
      }
      let scope = /* @__PURE__ */ Symbol("mixin-scope");
      handle.setActiveScope(scope);
      entry = {
        scope,
        type: descriptor.type,
        runner: normalizeMixinRunner(descriptor.type(handle, hostType), handle)
      };
      handle.setActiveScope(void 0);
      state.runners[index] = entry;
      let binding = state.binding;
      if (binding?.node) {
        queueMixinInsert(handle, entry.scope, binding.node, binding.parent, binding.key);
      }
    }
    handle.setActiveScope(entry.scope);
    let result = entry.runner(...descriptor.args, mixinProps);
    handle.setActiveScope(void 0);
    return result;
  });
  for (let index = runnerCount; index < state.runners.length; index++) {
    let entry = state.runners[index];
    if (entry) {
      handle.dispatchScopedEvent(entry.scope, new Event("remove"));
      handle.releaseScope(entry.scope);
    }
  }
  if (state.runners.length > runnerCount) {
    state.runners.length = runnerCount;
  }
  return { state, props };
}
function teardownMixins(state) {
  if (!state)
    return;
  state.binding = void 0;
  prepareMixinRemoval(state);
  cancelPendingMixinRemoval(state);
  let handle = state.handle;
  if (handle) {
    handle.queueCommitTask(() => finalizeMixinTeardown(state));
    return;
  }
  finalizeMixinTeardown(state);
}
function bindMixinRuntime(state, binding, options) {
  if (!state)
    return;
  let previousNode = state.binding?.node;
  let nextBinding = binding;
  state.binding = nextBinding;
  if (!nextBinding?.node || previousNode === nextBinding.node)
    return;
  let nextNode = nextBinding.node;
  let handle = state.handle;
  if (!handle)
    return;
  for (let entry of state.runners) {
    if (options?.dispatchReclaimed) {
      queueMixinReclaimed(handle, entry.scope, nextNode, nextBinding.parent, nextBinding.key);
    } else {
      queueMixinInsert(handle, entry.scope, nextNode, nextBinding.parent, nextBinding.key);
    }
  }
}
function prepareMixinRemoval(state) {
  if (!state || state.removePrepared)
    return state?.pendingRemoval?.done;
  state.removePrepared = true;
  let pendingRemoval;
  let persistTeardowns = [];
  let registerPersistNode = (teardown) => {
    persistTeardowns.push(teardown);
  };
  let handle = state.handle;
  if (!handle)
    return;
  for (let entry of state.runners) {
    dispatchMixinBeforeRemove(handle, entry.scope, registerPersistNode);
  }
  if (persistTeardowns.length > 0) {
    let controller = new AbortController();
    let done = Promise.allSettled(persistTeardowns.map((teardown) => Promise.resolve().then(() => teardown(controller.signal)))).then(() => {
    });
    pendingRemoval = {
      signal: controller.signal,
      cancel(reason) {
        controller.abort(reason);
      },
      done
    };
  }
  state.pendingRemoval = pendingRemoval;
  return pendingRemoval?.done;
}
function cancelPendingMixinRemoval(state, reason = new DOMException("", "AbortError")) {
  if (!state?.pendingRemoval)
    return;
  state.pendingRemoval.cancel(reason);
  state.pendingRemoval = void 0;
  state.removePrepared = false;
}
function createMixinRuntimeState() {
  return {
    id: `m${++mixinHandleId}`,
    aborted: false,
    runners: []
  };
}
function createMixinHandle(options) {
  return new MixinHandleImpl(options);
}
var MixinHandleImpl = class extends TypedEventTarget {
  id;
  context;
  frame;
  element;
  #options;
  #phaseListenerCounts = {
    beforeUpdate: 0,
    commit: 0
  };
  #activeScope;
  #scopeSignals = /* @__PURE__ */ new Map();
  #scopeTargets = /* @__PURE__ */ new Map();
  #scopePhaseCounts = /* @__PURE__ */ new Map();
  #onSchedulerBeforeUpdate = (event) => {
    this.#dispatchSchedulerPhaseToHandle("beforeUpdate", event);
  };
  #onSchedulerCommit = (event) => {
    this.#dispatchSchedulerPhaseToHandle("commit", event);
  };
  constructor(options) {
    super();
    this.#options = options;
    this.id = options.id;
    this.context = {
      get: options.getContext
    };
    this.frame = options.frame;
    let element = ((_, __) => (props) => ({
      $rmx: true,
      type: options.hostType,
      key: null,
      props
    }));
    element.__rmxMixinElementType = options.hostType;
    this.element = element;
  }
  get signal() {
    let scope = this.#activeScope;
    invariant(scope, "handle.signal is only available during mixin setup, render, or lifecycle callbacks");
    return this.#getScopeSignal(scope);
  }
  addEventListener(type, listener, options) {
    let target = this.#getActiveScopeTarget();
    target.addEventListener(type, listener, options);
    if (!listener || !isSchedulerPhaseType(type))
      return;
    let scope = this.#activeScope;
    invariant(scope);
    let scopePhaseCounts = this.#scopePhaseCounts.get(scope);
    invariant(scopePhaseCounts);
    scopePhaseCounts[type] += 1;
    this.#phaseListenerCounts[type] += 1;
    if (this.#phaseListenerCounts[type] !== 1)
      return;
    if (type === "beforeUpdate") {
      this.#options.scheduler.addEventListener("beforeUpdate", this.#onSchedulerBeforeUpdate);
    } else {
      this.#options.scheduler.addEventListener("commit", this.#onSchedulerCommit);
    }
  }
  removeEventListener(type, listener, options) {
    let target = this.#getActiveScopeTarget();
    target.removeEventListener(type, listener, typeof options === "boolean" ? { capture: options } : options);
    if (!listener || !isSchedulerPhaseType(type))
      return;
    let scope = this.#activeScope;
    invariant(scope);
    let scopePhaseCounts = this.#scopePhaseCounts.get(scope);
    invariant(scopePhaseCounts);
    scopePhaseCounts[type] = Math.max(0, scopePhaseCounts[type] - 1);
    this.#phaseListenerCounts[type] = Math.max(0, this.#phaseListenerCounts[type] - 1);
    if (this.#phaseListenerCounts[type] !== 0)
      return;
    if (type === "beforeUpdate") {
      this.#options.scheduler.removeEventListener("beforeUpdate", this.#onSchedulerBeforeUpdate);
    } else {
      this.#options.scheduler.removeEventListener("commit", this.#onSchedulerCommit);
    }
  }
  update() {
    return new Promise((resolve) => {
      let signal = this.#options.getRuntimeSignal();
      if (signal.aborted) {
        resolve(signal);
        return;
      }
      let binding = this.#options.getBinding();
      if (!binding) {
        resolve(signal);
        return;
      }
      binding.enqueueUpdate(resolve);
    });
  }
  queueTask(task) {
    this.#options.scheduler.enqueueTasks([
      () => {
        let binding = this.#options.getBinding();
        invariant(binding);
        task(binding.node, this.#options.getRuntimeSignal());
      }
    ]);
  }
  queueCommitTask(task) {
    this.#options.scheduler.enqueueCommitPhase([task]);
  }
  setActiveScope(scope) {
    this.#activeScope = scope;
    if (!scope)
      return;
    if (this.#scopeTargets.has(scope))
      return;
    this.#scopeTargets.set(scope, new TypedEventTarget());
    this.#scopePhaseCounts.set(scope, { beforeUpdate: 0, commit: 0 });
  }
  dispatchScopedEvent(scope, event) {
    let previousScope = this.#activeScope;
    this.#activeScope = scope;
    this.#scopeTargets.get(scope)?.dispatchEvent(event);
    this.#activeScope = previousScope;
  }
  releaseScope(scope) {
    let scopePhaseCounts = this.#scopePhaseCounts.get(scope);
    if (scopePhaseCounts) {
      this.#decrementGlobalPhaseCount("beforeUpdate", scopePhaseCounts.beforeUpdate);
      this.#decrementGlobalPhaseCount("commit", scopePhaseCounts.commit);
    }
    let controller = this.#scopeSignals.get(scope);
    if (controller) {
      controller.abort();
      this.#scopeSignals.delete(scope);
    }
    this.#scopePhaseCounts.delete(scope);
    this.#scopeTargets.delete(scope);
    if (this.#activeScope === scope) {
      this.#activeScope = void 0;
    }
  }
  #dispatchSchedulerPhaseToHandle(type, event) {
    let binding = this.#options.getBinding();
    if (!binding)
      return;
    if (!isBindingInUpdateScope(binding, event.parents))
      return;
    for (let [, target] of this.#scopeTargets) {
      let updateEvent = new Event(type);
      updateEvent.node = binding.node;
      target.dispatchEvent(updateEvent);
    }
  }
  #getActiveScopeTarget() {
    let scope = this.#activeScope;
    invariant(scope);
    let target = this.#scopeTargets.get(scope);
    invariant(target);
    return target;
  }
  #getScopeSignal(scope) {
    let controller = this.#scopeSignals.get(scope);
    if (!controller) {
      controller = new AbortController();
      this.#scopeSignals.set(scope, controller);
    }
    return controller.signal;
  }
  #decrementGlobalPhaseCount(type, amount) {
    if (amount <= 0)
      return;
    this.#phaseListenerCounts[type] = Math.max(0, this.#phaseListenerCounts[type] - amount);
    if (this.#phaseListenerCounts[type] !== 0)
      return;
    if (type === "beforeUpdate") {
      this.#options.scheduler.removeEventListener("beforeUpdate", this.#onSchedulerBeforeUpdate);
    } else {
      this.#options.scheduler.removeEventListener("commit", this.#onSchedulerCommit);
    }
  }
};
function getMixinRuntimeSignal(state) {
  let controller = state.controller;
  if (!controller) {
    controller = new AbortController();
    if (state.aborted) {
      controller.abort();
    }
    state.controller = controller;
  }
  return controller.signal;
}
function dispatchMixinBeforeUpdate(state) {
  dispatchMixinUpdateEvent(state, "beforeUpdate");
}
function dispatchMixinCommit(state) {
  dispatchMixinUpdateEvent(state, "commit");
}
function dispatchMixinInsert(handle, scope, node, parent, key) {
  let event = new Event("insert");
  event.node = node;
  event.parent = parent;
  event.key = key;
  handle.dispatchScopedEvent(scope, event);
}
function dispatchMixinReclaimed(handle, scope, node, parent, key) {
  let event = new Event("reclaimed");
  event.node = node;
  event.parent = parent;
  event.key = key;
  handle.dispatchScopedEvent(scope, event);
}
function dispatchMixinBeforeRemove(handle, scope, persistNode) {
  let event = new Event("beforeRemove");
  event.persistNode = persistNode;
  handle.dispatchScopedEvent(scope, event);
}
function queueMixinInsert(handle, scope, node, parent, key) {
  handle.queueCommitTask(() => {
    dispatchMixinInsert(handle, scope, node, parent, key);
  });
}
function queueMixinReclaimed(handle, scope, node, parent, key) {
  handle.queueCommitTask(() => {
    dispatchMixinReclaimed(handle, scope, node, parent, key);
  });
}
function queueMixinRemove(handle, scope) {
  handle.queueCommitTask(() => {
    handle.dispatchScopedEvent(scope, new Event("remove"));
    handle.releaseScope(scope);
  });
}
function dispatchMixinRemoveEvent(state) {
  let runners = state?.runners;
  if (!runners?.length)
    return;
  let handle = state?.handle;
  if (!handle)
    return;
  for (let entry of runners) {
    handle.dispatchScopedEvent(entry.scope, new Event("remove"));
  }
}
function finalizeMixinTeardown(state) {
  dispatchMixinRemoveEvent(state);
  let handle = state.handle;
  if (handle) {
    for (let entry of state.runners) {
      handle.releaseScope(entry.scope);
    }
  }
  state.runners.length = 0;
  state.aborted = true;
  state.controller?.abort();
  state.pendingRemoval = void 0;
  state.removePrepared = true;
  state.handle = void 0;
}
function dispatchMixinUpdateEvent(state, type) {
  let node = state?.binding?.node;
  if (!node)
    return;
  let runners = state?.runners;
  if (!runners?.length)
    return;
  let handle = state?.handle;
  if (!handle)
    return;
  for (let entry of runners) {
    let event = new Event(type);
    event.node = node;
    handle.dispatchScopedEvent(entry.scope, event);
  }
}
function isSchedulerPhaseType(type) {
  return type === "beforeUpdate" || type === "commit";
}
function isBindingInUpdateScope(binding, parents) {
  if (parents.length === 0)
    return false;
  let node = binding.node;
  for (let parent of parents) {
    let parentNode = parent;
    if (parentNode === node)
      return true;
    if (parentNode.contains(node))
      return true;
  }
  return false;
}
function normalizeMixinRunner(result, handle) {
  if (typeof result === "function" && !isMixinElementFunction(result)) {
    return result;
  }
  if (result === void 0) {
    return () => handle.element;
  }
  return () => result;
}

// node_modules/@remix-run/component/dist/runtime/mixins/on-mixin.js
var onMixinType = (handle) => {
  let currentHandler = () => {
  };
  let currentType = "";
  let currentCapture = false;
  let currentNode = null;
  let reentry = null;
  let stableHandler = (event) => {
    reentry?.abort(new DOMException("", "EventReentry"));
    reentry = new AbortController();
    void currentHandler(event, reentry.signal);
  };
  handle.addEventListener("insert", (event) => {
    currentNode = event.node;
    currentNode.addEventListener(currentType, stableHandler, currentCapture);
  });
  handle.addEventListener("remove", () => {
    currentNode?.removeEventListener(currentType, stableHandler, currentCapture);
    currentNode = null;
    reentry?.abort(new DOMException("", "AbortError"));
  });
  return (type, handler, captureBoolean = false) => {
    let previousType = currentType;
    let previousCapture = currentCapture;
    let needsRebind = currentType !== type || currentCapture !== captureBoolean;
    currentType = type;
    currentHandler = handler;
    currentCapture = captureBoolean;
    if (needsRebind && currentNode) {
      currentNode.removeEventListener(previousType, stableHandler, previousCapture);
      currentNode.addEventListener(type, stableHandler, captureBoolean);
    }
    return handle.element;
  };
};
var onMixin = createMixin(onMixinType);
function isOnMixinDescriptor(descriptor) {
  if (!descriptor || typeof descriptor !== "object")
    return false;
  let candidate = descriptor;
  return candidate.type === onMixinType && Array.isArray(candidate.args);
}

// node_modules/@remix-run/component/dist/runtime/refresh.js
var componentStalenessCheck = null;
var roots = /* @__PURE__ */ new Set();
function registerRoot(root) {
  roots.add(root);
}
function unregisterRoot(root) {
  roots.delete(root);
}

// node_modules/@remix-run/component/dist/runtime/client-entry-boundary.js
var CLIENT_ENTRY_BOUNDARY_OWNER = /* @__PURE__ */ Symbol("ClientEntryBoundaryOwner");
function getClientEntryBoundaryOwner(marker) {
  return marker[CLIENT_ENTRY_BOUNDARY_OWNER];
}
function setClientEntryBoundaryOwner(marker, end, identity, root) {
  let owner = { end, identity, root };
  Object.defineProperties(marker, {
    [CLIENT_ENTRY_BOUNDARY_OWNER]: {
      configurable: true,
      value: owner
    },
    $rmx: {
      configurable: true,
      value: root
    }
  });
  return owner;
}
function disposeClientEntryBoundary(marker) {
  let boundaryMarker = marker;
  let owner = boundaryMarker[CLIENT_ENTRY_BOUNDARY_OWNER];
  if (!owner)
    return false;
  delete boundaryMarker[CLIENT_ENTRY_BOUNDARY_OWNER];
  delete boundaryMarker.$rmx;
  owner.root.dispose();
  return true;
}

// node_modules/@remix-run/component/dist/runtime/reconcile.js
var SVG_NS2 = "http://www.w3.org/2000/svg";
var idCounter = 0;
var persistedRemovalToken = 0;
var persistedMixinNodes = /* @__PURE__ */ new Set();
var activeSchedulerUpdateParents;
function getSvgContext(vParent, node) {
  if (node.kind === "host") {
    if (node.type === "svg")
      return true;
    if (node.type === "foreignObject")
      return false;
  }
  return vParent._svg;
}
function getHostProps(node) {
  return "_mixedProps" in node ? node._mixedProps : node.props;
}
function markNodePersistedByMixins(node, domParent, token) {
  node._persistence = { parent: domParent, token };
  persistedMixinNodes.add(node);
  bindMixinRuntime(node._mixState, void 0);
}
function unmarkNodePersistedByMixins(node) {
  node._persistence = void 0;
  persistedMixinNodes.delete(node);
}
function findMatchingPersistedMixinNode(type, key, domParent) {
  if (key == null)
    return null;
  for (let node of persistedMixinNodes) {
    if (node._persistence?.parent !== domParent)
      continue;
    if (node.type !== type)
      continue;
    if (node.key !== key)
      continue;
    return node;
  }
  return null;
}
var EMPTY_DIRECT_EVENT_DESCRIPTORS = [];
var EMPTY_COMMITTED_CHILDREN = [];
function shouldRestoreControlledReflectionOnInput(node, state) {
  if (state.hasControlledChecked)
    return false;
  if (node.type === "select")
    return false;
  return true;
}
function ensureControlledReflection(node, scheduler) {
  let existing = node._controlledState;
  if (existing)
    return existing;
  let state = {
    disposed: false,
    listenersAttached: false,
    pendingRestoreVersion: 0,
    managesValue: false,
    managesChecked: false,
    hasControlledValue: false,
    controlledValue: void 0,
    hasControlledChecked: false,
    controlledChecked: void 0,
    onInput: () => {
      if (!shouldRestoreControlledReflectionOnInput(node, state))
        return;
      scheduleControlledRestore(node, state);
    },
    onChange: () => {
      scheduleControlledRestore(node, state);
    }
  };
  node._controlledState = state;
  scheduler.enqueueTasks([
    () => {
      if (state.disposed)
        return;
      node._dom.addEventListener("input", state.onInput);
      node._dom.addEventListener("change", state.onChange);
      state.listenersAttached = true;
    }
  ]);
  return state;
}
function syncControlledReflection(node, props) {
  let state = node._controlledState;
  if (!state || state.disposed)
    return;
  state.managesValue = canManageValue(node.type, node._dom);
  state.managesChecked = canReflectProperty(node._dom, "checked");
  state.hasControlledValue = state.managesValue && hasControlledValueProp(props);
  state.controlledValue = props.value;
  state.hasControlledChecked = state.managesChecked && hasControlledCheckedProp(props);
  state.controlledChecked = props.checked;
  state.pendingRestoreVersion++;
}
function shouldTrackControlledReflection(props) {
  return hasControlledValueProp(props) || hasControlledCheckedProp(props);
}
function scheduleControlledRestore(node, state) {
  if (state.disposed)
    return;
  let version = ++state.pendingRestoreVersion;
  queueMicrotask(() => {
    if (state.disposed)
      return;
    if (state.pendingRestoreVersion !== version)
      return;
    restoreControlledReflections(node, state);
  });
}
function restoreControlledReflections(node, state) {
  let element = node._dom;
  if (state.hasControlledValue && readDomProp(element, "value") !== state.controlledValue) {
    setPropertyReflection(element, "value", state.controlledValue);
  }
  if (state.hasControlledChecked && readDomProp(element, "checked") !== state.controlledChecked) {
    setPropertyReflection(element, "checked", state.controlledChecked);
  }
}
function teardownControlledReflection(node) {
  let state = node._controlledState;
  if (!state)
    return;
  state.disposed = true;
  state.pendingRestoreVersion++;
  if (state.listenersAttached) {
    node._dom.removeEventListener("input", state.onInput);
    node._dom.removeEventListener("change", state.onChange);
    state.listenersAttached = false;
  }
}
function abandonControlledReflection(node) {
  let state = node._controlledState;
  if (!state)
    return;
  state.disposed = true;
  state.pendingRestoreVersion++;
  state.listenersAttached = false;
}
function canManageValue(type, element) {
  if (type === "progress")
    return false;
  return canReflectProperty(element, "value");
}
function hasControlledValueProp(props) {
  return "value" in props && props.value !== void 0;
}
function hasControlledCheckedProp(props) {
  return "checked" in props && props.checked !== void 0;
}
function canReflectProperty(element, key) {
  return key in element && !key.includes("-");
}
function readDomProp(element, key) {
  if (!canReflectProperty(element, key))
    return void 0;
  return element[key];
}
function setPropertyReflection(element, key, value) {
  if (!canReflectProperty(element, key))
    return;
  element[key] = value == null ? "" : value;
}
function resolveNodeMixProps(node, parent, frame, scheduler, state) {
  let mix = node.props.mix;
  let directEventDescriptors = resolveDirectEventDescriptors(mix);
  if (directEventDescriptors) {
    if (state)
      teardownMixins(state);
    return { props: node.props, directEventDescriptors };
  }
  if (state == null && (mix == null || Array.isArray(mix) && mix.length === 0)) {
    return { props: node.props };
  }
  let resolved = resolveMixedProps({
    hostType: node.type,
    frame,
    scheduler,
    getContext: (type) => {
      if (typeof type !== "function") {
        return void 0;
      }
      return findContextFromAncestry(parent, type);
    },
    props: node.props,
    state
  });
  return { props: resolved.props, mixState: resolved.state };
}
function applyResolvedHostProps(node, resolved) {
  node._mixedProps = resolved.props;
  node._mixState = resolved.mixState;
  node._directEventDescriptors = resolved.directEventDescriptors;
}
function resolveDirectEventDescriptors(mix) {
  if (!mix)
    return EMPTY_DIRECT_EVENT_DESCRIPTORS;
  if (!Array.isArray(mix)) {
    return isOnMixinDescriptor(mix) ? [mix] : null;
  }
  return areOnMixinDescriptors(mix) ? mix : null;
}
function areOnMixinDescriptors(descriptors) {
  for (let i = 0; i < descriptors.length; i++) {
    if (!isOnMixinDescriptor(descriptors[i]))
      return false;
  }
  return true;
}
function enqueueMixinBindingUpdate(done) {
  let node = this.target;
  let state = node._mixState;
  this.scheduler.enqueueWork([
    () => {
      if (state?.aborted) {
        done(getMixinRuntimeSignal(state));
        return;
      }
      dispatchMixinBeforeUpdate(state);
      let prevProps = getHostProps(node);
      let resolved = resolveNodeMixProps(node, node._parent, this.frame, this.scheduler, state);
      applyResolvedHostProps(node, resolved);
      patchHostProps(prevProps, resolved.props, this.node);
      if (node._controlledState || shouldTrackControlledReflection(resolved.props)) {
        ensureControlledReflection(node, this.scheduler);
        syncControlledReflection(node, resolved.props);
      }
      dispatchMixinCommit(state);
      done(state ? getMixinRuntimeSignal(state) : AbortSignal.abort());
    }
  ]);
}
function bindNodeMixRuntime(node, frame, scheduler, styles, reclaimed = false, parent) {
  let state = node._mixState;
  bindMixinRuntime(state, {
    node: node._dom,
    parent: parent ?? getRequiredDomParent(node._dom),
    key: node.key,
    target: node,
    frame,
    scheduler,
    enqueueUpdate: enqueueMixinBindingUpdate
  }, { dispatchReclaimed: reclaimed });
}
function isHeadHostNode(node) {
  if (node.type === "head")
    return true;
  if (node.type.length !== 4)
    return false;
  return node.type.toLowerCase() === "head";
}
function getRequiredDomParent(node) {
  let parent = node.parentNode;
  invariant(parent, "Expected mounted host node to have a DOM parent");
  return parent;
}
function getDocumentHead(domParent) {
  if (domParent instanceof Document) {
    return domParent.head;
  }
  if (domParent instanceof Node) {
    return domParent.ownerDocument?.head ?? null;
  }
  return null;
}
function commitNonRenderNode(node, parent, svg) {
  let committed = node;
  committed._parent = parent;
  committed._svg = svg;
  return committed;
}
function commitTextNode(node, parent, svg, dom) {
  let committed = node;
  committed._parent = parent;
  committed._svg = svg;
  committed._dom = dom;
  return committed;
}
function beginFragmentNode(node, parent, svg) {
  let committed = node;
  committed._parent = parent;
  committed._svg = svg;
  committed._children = EMPTY_COMMITTED_CHILDREN;
  return committed;
}
function commitHostNode(node, parent, svg, dom, resolved, children = EMPTY_COMMITTED_CHILDREN) {
  let committed = node;
  committed._parent = parent;
  committed._svg = svg;
  committed._dom = dom;
  committed._children = children;
  committed._mixedProps = resolved.props;
  committed._mixState = resolved.mixState;
  committed._directEventDescriptors = resolved.directEventDescriptors;
  return committed;
}
function beginComponentNode(node, parent, svg, handle, context) {
  let mounting = node;
  mounting._parent = parent;
  mounting._svg = svg;
  mounting._handle = handle;
  mounting._context = context;
  return mounting;
}
function commitComponentNode(node, content) {
  let committed = node;
  committed._content = content;
  return committed;
}
function diffVNodes(curr, next, domParent, vParent, context, anchor, cursor) {
  if (curr === null) {
    return insert(next, domParent, vParent, context, anchor, cursor);
  }
  if (isCommittedClientEntryNode(curr) && next.kind === "component" && isEntry(next.type)) {
    return diffClientEntryBoundary(curr, next, vParent, context);
  }
  if (componentStalenessCheck !== null && curr.kind === "component" && next.kind === "component" && componentStalenessCheck(curr.type) === true) {
    return replace(curr, next, domParent, vParent, context, anchor);
  }
  if (curr.kind !== next.kind || curr.type !== next.type) {
    return replace(curr, next, domParent, vParent, context, anchor);
  }
  switch (next.kind) {
    case "host": {
      return diffHost(curr, next, vParent, context);
    }
    case "text": {
      return diffText(curr, next, vParent, getSvgContext(vParent, next));
    }
    case "empty": {
      return commitNonRenderNode(next, vParent, getSvgContext(vParent, next));
    }
    case "fragment": {
      let childInputs = next._children;
      let committed = beginFragmentNode(next, vParent, getSvgContext(vParent, next));
      committed._children = diffChildren(curr._children, childInputs, domParent, committed, context, void 0, anchor);
      return committed;
    }
    case "frame": {
      return diffFrame(curr, next, domParent, vParent, context, getSvgContext(vParent, next), anchor);
    }
    case "component": {
      return diffComponent(curr, next, domParent, vParent, context, getSvgContext(vParent, next), anchor, cursor);
    }
  }
}
function replace(curr, next, domParent, vParent, context, anchor) {
  let currAnchor = findFirstDomAnchor(curr);
  if (currAnchor && currAnchor.parentNode === domParent) {
    let replacementAnchor2 = document.createComment("rmx:replace");
    domParent.insertBefore(replacementAnchor2, currAnchor);
    try {
      remove(curr, domParent, context);
      return insert(next, domParent, vParent, context, replacementAnchor2);
    } finally {
      replacementAnchor2.parentNode?.removeChild(replacementAnchor2);
    }
  }
  let replacementAnchor = findNextSiblingDomAnchor(curr) ?? anchor;
  remove(curr, domParent, context);
  return insert(next, domParent, vParent, context, replacementAnchor);
}
function diffHost(curr, next, vParent, context) {
  let { frame, scheduler, styles } = context;
  let mixState = curr._mixState;
  let currProps = getHostProps(curr);
  let resolved = resolveNodeMixProps(next, vParent, frame, scheduler, mixState);
  let childInputs = next._children;
  let nextProps = resolved.props;
  let nextMixState = resolved.mixState;
  let shouldDispatchMixinLifecycle = (nextMixState?.runners.length ?? 0) > 0 && shouldDispatchInlineMixinLifecycle(curr._dom);
  if (shouldDispatchMixinLifecycle) {
    dispatchMixinBeforeUpdate(nextMixState);
  }
  if (nextProps.innerHTML != null) {
    if (currProps.innerHTML !== nextProps.innerHTML) {
      curr._dom.innerHTML = nextProps.innerHTML;
    }
  } else if (currProps.innerHTML != null) {
    curr._dom.innerHTML = "";
  }
  let committed = commitHostNode(next, vParent, getSvgContext(vParent, next), curr._dom, resolved);
  committed._directEventState = curr._directEventState;
  committed._controlledState = curr._controlledState;
  committed._children = diffChildren(curr._children, childInputs, curr._dom, committed, context);
  patchHostProps(currProps, nextProps, curr._dom);
  syncDirectEventListeners(committed);
  if (committed._controlledState || shouldTrackControlledReflection(nextProps)) {
    ensureControlledReflection(committed, scheduler);
    syncControlledReflection(committed, nextProps);
  }
  if (committed._mixState) {
    bindNodeMixRuntime(committed, frame, scheduler, styles);
  }
  if (shouldDispatchMixinLifecycle) {
    scheduler.enqueueCommitPhase([() => dispatchMixinCommit(nextMixState)]);
  }
  return committed;
}
function setupHostNode(node, scheduler) {
  let props = getHostProps(node);
  syncDirectEventListeners(node);
  if (shouldTrackControlledReflection(props)) {
    ensureControlledReflection(node, scheduler);
    syncControlledReflection(node, props);
  }
}
function syncDirectEventListeners(node) {
  let descriptors = node._directEventDescriptors;
  if (!descriptors) {
    teardownDirectEventListeners(node);
    return;
  }
  if (descriptors.length === 0) {
    teardownDirectEventListeners(node);
    return;
  }
  let state = node._directEventState;
  if (!state) {
    state = { bindings: [] };
    node._directEventState = state;
  }
  let bindings = state.bindings;
  for (let index = 0; index < descriptors.length; index++) {
    let args = descriptors[index].args;
    let type = args[0];
    let handler = args[1];
    let captureBoolean = args[2] ?? false;
    let binding = bindings[index];
    if (!binding) {
      binding = createDirectEventBinding(type, handler, captureBoolean);
      bindings[index] = binding;
      attachDirectEventBinding(node._dom, binding);
      continue;
    }
    if (binding.type !== type || binding.capture !== captureBoolean) {
      removeDirectEventBinding(node._dom, binding);
      binding.type = type;
      binding.capture = captureBoolean;
      attachDirectEventBinding(node._dom, binding);
    }
    binding.handler = handler;
  }
  for (let index = descriptors.length; index < bindings.length; index++) {
    removeDirectEventBinding(node._dom, bindings[index]);
  }
  bindings.length = descriptors.length;
}
function createDirectEventBinding(type, handler, capture) {
  let binding = {
    type,
    handler,
    capture,
    reentry: null,
    stableHandler: null
  };
  return binding;
}
function getStableDirectEventHandler(binding) {
  if (binding.stableHandler)
    return binding.stableHandler;
  binding.stableHandler = (event) => {
    invokeDirectEventBinding(binding, event);
  };
  return binding.stableHandler;
}
function attachDirectEventBinding(dom, binding) {
  dom.addEventListener(binding.type, getStableDirectEventHandler(binding), binding.capture);
}
function removeDirectEventBinding(dom, binding) {
  if (binding.stableHandler) {
    dom.removeEventListener(binding.type, binding.stableHandler, binding.capture);
  }
  binding.reentry?.abort(new DOMException("", "AbortError"));
  binding.reentry = null;
}
function teardownDirectEventListeners(node) {
  let state = node._directEventState;
  if (!state)
    return;
  for (let binding of state.bindings) {
    removeDirectEventBinding(node._dom, binding);
  }
  state.bindings.length = 0;
  node._directEventState = void 0;
}
function abandonDirectEventListeners(node) {
  let state = node._directEventState;
  if (!state)
    return;
  for (let binding of state.bindings) {
    binding.reentry?.abort(new DOMException("", "AbortError"));
    binding.reentry = null;
  }
  state.bindings.length = 0;
  node._directEventState = void 0;
}
function invokeDirectEventBinding(binding, event) {
  binding.reentry?.abort(new DOMException("", "EventReentry"));
  binding.reentry = new AbortController();
  void binding.handler(event, binding.reentry.signal);
}
function diffText(curr, next, vParent, svg) {
  if (curr._text !== next._text) {
    curr._dom.textContent = next._text;
  }
  return commitTextNode(next, vParent, svg, curr._dom);
}
function insert(node, domParent, vParent, context, anchor, cursor) {
  let { frame, scheduler, styles } = context;
  let svg = getSvgContext(vParent, node);
  let hydrationNode = cursor?.current;
  if (hydrationNode && anchor && hydrationNode === anchor) {
    hydrationNode = null;
  }
  hydrationNode = skipCommentsExceptBoundaryStart(hydrationNode ?? null, node.kind === "component" || node.kind === "fragment" || node.kind === "empty");
  if (hydrationNode && anchor && hydrationNode === anchor) {
    hydrationNode = null;
  }
  if (cursor)
    cursor.current = hydrationNode;
  if (vParent.kind !== "root" && node.kind === "component" && isEntry(node.type) && hydrationNode instanceof Comment) {
    let runtime = getFrameRuntime(frame);
    let pending = runtime?.pendingClientEntries.get(hydrationNode);
    let owner = getClientEntryBoundaryOwner(hydrationNode);
    let end = pending?.[0] ?? owner?.end;
    if (end) {
      let committed = commitClientEntryBoundary(node, vParent, svg, hydrationNode, end);
      updateClientEntryBoundary(committed, context);
      if (cursor)
        cursor.current = end.nextSibling;
      return committed;
    }
  }
  let doInsert = anchor ? (dom) => domParent.insertBefore(dom, anchor) : (dom) => domParent.appendChild(dom);
  if (node.kind === "empty") {
    return commitNonRenderNode(node, vParent, svg);
  }
  if (node.kind === "text") {
    if (hydrationNode instanceof Text) {
      if (hydrationNode.data !== node._text) {
        if (hydrationNode.data.startsWith(node._text) && node._text.length < hydrationNode.data.length) {
          let remainder = hydrationNode.splitText(node._text.length);
          if (cursor)
            cursor.current = remainder;
          return commitTextNode(node, vParent, svg, hydrationNode);
        }
        if (node._text.startsWith(hydrationNode.data) && hydrationNode.data.length < node._text.length) {
          let remainder = node._text.slice(hydrationNode.data.length);
          let sibling = hydrationNode.nextSibling;
          while (remainder.length > 0 && sibling instanceof Text && remainder.startsWith(sibling.data)) {
            remainder = remainder.slice(sibling.data.length);
            let next = sibling.nextSibling;
            sibling.remove();
            sibling = next;
          }
          if (remainder.length > 0 && sibling instanceof Text && sibling.data.startsWith(remainder)) {
            sibling.deleteData(0, remainder.length);
          }
          hydrationNode.data = node._text;
          if (cursor)
            cursor.current = sibling;
          return commitTextNode(node, vParent, svg, hydrationNode);
        }
        logHydrationMismatch("text mismatch", hydrationNode.data, node._text);
        hydrationNode.data = node._text;
      }
      if (cursor)
        cursor.current = hydrationNode.nextSibling;
      return commitTextNode(node, vParent, svg, hydrationNode);
    }
    let dom = document.createTextNode(node._text);
    doInsert(dom);
    return commitTextNode(node, vParent, svg, dom);
  }
  if (node.kind === "host") {
    let resolved = resolveNodeMixProps(node, vParent, frame, scheduler);
    let hostProps = resolved.props;
    let childInputs = node._children;
    if (isHeadHostNode(node)) {
      let targetHead = getDocumentHead(domParent);
      if (targetHead) {
        let childCursor = cursor ? { current: hydrationNode } : void 0;
        if (hydrationNode instanceof Element && hydrationNode.tagName.toLowerCase() === "head") {
          if (childCursor)
            childCursor.current = hydrationNode.firstChild;
          let nextCursor = hydrationNode.nextSibling;
          if (hydrationNode !== targetHead) {
            while (hydrationNode.firstChild) {
              targetHead.appendChild(hydrationNode.firstChild);
            }
            hydrationNode.remove();
          }
          if (cursor)
            cursor.current = nextCursor;
        }
        let committed2 = commitHostNode(node, vParent, svg, targetHead, resolved);
        committed2._children = diffChildren(null, childInputs, targetHead, committed2, context, childCursor);
        patchHostProps({}, hostProps, targetHead);
        setupHostNode(committed2, scheduler);
        if (committed2._mixState) {
          bindNodeMixRuntime(committed2, frame, scheduler, styles);
        }
        return committed2;
      }
    }
    let persistedNode = findMatchingPersistedMixinNode(node.type, node.key, domParent);
    if (persistedNode) {
      return reclaimPersistedMixinNode(persistedNode, node, vParent, context);
    }
    if (hydrationNode instanceof Element) {
      let cursorTag = svg ? hydrationNode.tagName : hydrationNode.tagName.toLowerCase();
      if (cursorTag === node.type) {
        let nextCursor = hydrationNode.nextSibling;
        patchHostProps({}, hostProps, hydrationNode);
        let committed2 = commitHostNode(node, vParent, svg, hydrationNode, resolved);
        if (hostProps.innerHTML != null) {
          hydrationNode.innerHTML = hostProps.innerHTML;
        } else {
          let childCursor = { current: hydrationNode.firstChild };
          committed2._children = diffChildren(null, childInputs, hydrationNode, committed2, context, childCursor);
        }
        setupHostNode(committed2, scheduler);
        if (committed2._mixState) {
          bindNodeMixRuntime(committed2, frame, scheduler, styles);
        }
        if (cursor)
          cursor.current = nextCursor;
        return committed2;
      } else {
        let nextSibling = skipComments(hydrationNode.nextSibling);
        if (nextSibling instanceof Element) {
          let nextTag = svg ? nextSibling.tagName : nextSibling.tagName.toLowerCase();
          if (nextTag === node.type) {
            let nextCursor = nextSibling.nextSibling;
            patchHostProps({}, hostProps, nextSibling);
            let committed2 = commitHostNode(node, vParent, svg, nextSibling, resolved);
            if (hostProps.innerHTML != null) {
              nextSibling.innerHTML = hostProps.innerHTML;
            } else {
              let childCursor = { current: nextSibling.firstChild };
              committed2._children = diffChildren(null, childInputs, nextSibling, committed2, context, childCursor);
            }
            setupHostNode(committed2, scheduler);
            if (committed2._mixState) {
              bindNodeMixRuntime(committed2, frame, scheduler, styles);
            }
            if (cursor)
              cursor.current = nextCursor;
            return committed2;
          }
        }
        logHydrationMismatch("tag", cursorTag, node.type);
        if (cursor)
          cursor.current = void 0;
      }
    }
    let dom = svg ? document.createElementNS(SVG_NS2, node.type) : document.createElement(node.type);
    patchHostProps({}, hostProps, dom);
    let committed = commitHostNode(node, vParent, svg, dom, resolved);
    if (hostProps.innerHTML != null) {
      dom.innerHTML = hostProps.innerHTML;
    } else {
      committed._children = diffChildren(null, childInputs, dom, committed, context);
    }
    setupHostNode(committed, scheduler);
    if (committed._mixState) {
      bindNodeMixRuntime(committed, frame, scheduler, styles, false, domParent);
    }
    doInsert(dom);
    return committed;
  }
  if (node.kind === "fragment") {
    let childInputs = node._children;
    let committed = beginFragmentNode(node, vParent, svg);
    let children = childInputs;
    for (let i = 0; i < childInputs.length; i++) {
      children[i] = insert(childInputs[i], domParent, committed, context, anchor, cursor);
    }
    committed._children = children;
    return committed;
  }
  if (node.kind === "component") {
    return diffComponent(null, node, domParent, vParent, context, svg, anchor, cursor);
  }
  if (node.kind === "frame") {
    return insertFrame(node, domParent, vParent, context, svg, anchor, cursor);
  }
  invariant(false, "Unexpected node type");
}
function diffFrame(curr, next, domParent, vParent, context, svg, anchor) {
  let { frame } = context;
  let currSrc = getFrameSrc(curr);
  let nextSrc = getFrameSrc(next);
  let currName = getFrameName(curr);
  let nextName = getFrameName(next);
  if (currName !== nextName) {
    let replaceAnchor = curr._rangeEnd.nextSibling ?? anchor;
    remove(curr, domParent, context);
    return insertFrame(next, domParent, vParent, context, svg, replaceAnchor);
  }
  if (currSrc !== nextSrc && !curr._state.resolved) {
    let replaceAnchor = curr._rangeEnd.nextSibling ?? anchor;
    remove(curr, domParent, context);
    return insertFrame(next, domParent, vParent, context, svg, replaceAnchor);
  }
  let committed = next;
  Object.assign(committed, {
    _rangeStart: curr._rangeStart,
    _rangeEnd: curr._rangeEnd,
    _state: curr._state,
    _parent: vParent,
    _svg: svg
  });
  let frameRuntime = getFrameRuntime(frame);
  let frameInstance = committed._state.instance;
  let serverFrameReload = frameRuntime?.serverFrameReload;
  if (currSrc !== nextSrc) {
    if (frameInstance) {
      frameInstance.handle.src = nextSrc;
    }
    if (frameRuntime) {
      resolveClientFrame(committed, frameRuntime, serverFrameReload);
    }
  } else if (frameRuntime && frameInstance && serverFrameReload) {
    resolveClientFrame(committed, frameRuntime, serverFrameReload);
  }
  if (!committed._state.resolved && committed._state.fallbackRoot) {
    committed._state.fallbackRoot.render(committed.props.fallback ?? null);
  }
  return committed;
}
function insertFrame(node, domParent, vParent, context, svg, anchor, cursor) {
  let { frame, styles } = context;
  let runtime = getFrameRuntime(frame);
  if (!runtime || runtime.canResolveFrames === false) {
    throw new Error("Cannot render <Frame /> without frame runtime. Use run() or pass frameInit to createRoot/createRangeRoot.");
  }
  if (isFrameStartComment(cursor?.current)) {
    let start2 = cursor.current;
    let end2 = findFrameEndComment(start2);
    if (end2) {
      let instance2 = runtime.frameInstances.get(start2);
      let getContext = (type) => findContextFromAncestry(vParent, type);
      let src = instance2?.handle.src ?? getFrameSrc(node);
      if (!instance2) {
        instance2 = createFrame([start2, end2], {
          name: getFrameName(node),
          src,
          getContext,
          errorTarget: runtime.errorTarget,
          loadModule: runtime.loadModule,
          resolveFrame: runtime.resolveFrame,
          pendingClientEntries: runtime.pendingClientEntries,
          scheduler: runtime.scheduler,
          styleManager: runtime.styleManager,
          data: {},
          moduleCache: runtime.moduleCache,
          moduleLoads: runtime.moduleLoads,
          frameInstances: runtime.frameInstances,
          namedFrames: runtime.namedFrames,
          processClientEntryPreloads: runtime.processClientEntryPreloads
        });
        runtime.frameInstances.set(start2, instance2);
      } else {
        let instanceRuntime = getFrameRuntime(instance2.handle);
        if (instanceRuntime)
          instanceRuntime.getContext = getContext;
      }
      cursor.current = end2.nextSibling;
      return Object.assign(node, {
        _rangeStart: start2,
        _rangeEnd: end2,
        _parent: vParent,
        _svg: svg,
        _state: {
          instance: instance2,
          resolveToken: 0,
          resolveController: void 0,
          fallbackRoot: void 0,
          resolved: true
        }
      });
    }
  }
  let start = document.createComment(` rmx:f:${randomFrameId()} `);
  let end = document.createComment(" /rmx:f ");
  let doInsert = anchor ? (dom) => domParent.insertBefore(dom, anchor) : (dom) => domParent.appendChild(dom);
  doInsert(start);
  doInsert(end);
  let fallbackRoot = createRangeRoot([start, end], {
    frame,
    getContext: (type) => findContextFromAncestry(vParent, type),
    styleManager: styles
  });
  fallbackRoot.render(node.props.fallback ?? null);
  let instance = createFrame([start, end], {
    name: getFrameName(node),
    src: getFrameSrc(node),
    getContext: (type) => findContextFromAncestry(vParent, type),
    errorTarget: runtime.errorTarget,
    loadModule: runtime.loadModule,
    resolveFrame: runtime.resolveFrame,
    pendingClientEntries: runtime.pendingClientEntries,
    scheduler: runtime.scheduler,
    styleManager: runtime.styleManager,
    data: {},
    moduleCache: runtime.moduleCache,
    moduleLoads: runtime.moduleLoads,
    frameInstances: runtime.frameInstances,
    namedFrames: runtime.namedFrames,
    processClientEntryPreloads: runtime.processClientEntryPreloads
  });
  runtime.frameInstances.set(start, instance);
  let committed = Object.assign(node, {
    _rangeStart: start,
    _rangeEnd: end,
    _parent: vParent,
    _svg: svg,
    _state: {
      instance,
      fallbackRoot,
      resolved: false,
      resolveToken: 0,
      resolveController: void 0
    }
  });
  resolveClientFrame(committed, runtime, runtime.serverFrameReload);
  return committed;
}
function resolveClientFrame(node, runtime, serverFrameReload) {
  let frameSrc = getFrameSrc(node);
  let state = node._state;
  let instance = state.instance;
  let token = state.resolveToken + 1;
  state.resolveToken = token;
  state.resolveController?.abort();
  let reload = serverFrameReload ? instance.beginClientFrameReloadForAncestorReload(serverFrameReload.signal) : void 0;
  if (!reload) {
    instance.cancelReload();
  }
  let resolveController = reload?.controller ?? new AbortController();
  state.resolveController = resolveController;
  let frameCommitted = Promise.withResolvers();
  let resolve = Promise.resolve().then(() => runtime.resolveFrame(frameSrc, {
    signal: resolveController.signal,
    target: getFrameName(node)
  })).then(async (resolution) => {
    if (state.resolveToken !== token || resolveController.signal.aborted)
      return;
    let { content } = await unwrapFrameResolution(resolution);
    if (state.resolveToken !== token || resolveController.signal.aborted)
      return;
    state.fallbackRoot?.dispose();
    state.fallbackRoot = void 0;
    let nextContent = asAbortableFrameContent(content, resolveController.signal);
    await instance.render(nextContent, {
      signal: resolveController.signal,
      reconciliationTracker: serverFrameReload?.reconciliationTracker,
      blockingFrameTracker: serverFrameReload?.blockingFrameTracker,
      onCommit: frameCommitted.resolve
    });
    if (state.resolveToken !== token || resolveController.signal.aborted)
      return;
    state.resolved = true;
  }).catch((error) => {
    if (reload && state.resolveToken === token && !resolveController.signal.aborted) {
      runtime.errorTarget.dispatchEvent(createComponentErrorEvent(error));
    }
  }).finally(() => {
    frameCommitted.resolve();
    reload?.complete();
    if (state.resolveController === resolveController) {
      state.resolveController = void 0;
    }
  });
  if (serverFrameReload?.reconciliationTracker && !node.props.fallback) {
    serverFrameReload.reconciliationTracker.waitFor(resolve);
  }
  if (serverFrameReload?.blockingFrameTracker && !node.props.fallback) {
    serverFrameReload.blockingFrameTracker.waitFor(frameCommitted.promise);
  }
}
function disposeFrameResources(node) {
  let state = node._state;
  state.resolveToken++;
  state.resolveController?.abort();
  state.resolveController = void 0;
  state.fallbackRoot?.dispose();
  state.fallbackRoot = void 0;
  state.instance.dispose();
}
function asAbortableFrameContent(content, signal) {
  if (!(content instanceof ReadableStream))
    return content;
  return createAbortableReadableStream(content, signal);
}
function createAbortableReadableStream(source, signal) {
  let reader = source.getReader();
  let aborted = false;
  let onAbort = () => {
    aborted = true;
    void reader.cancel(signal.reason);
  };
  if (signal.aborted)
    onAbort();
  else
    signal.addEventListener("abort", onAbort, { once: true });
  return new ReadableStream({
    async pull(controller) {
      if (aborted) {
        controller.close();
        return;
      }
      let removeAbortReadListener;
      let abortRead = new Promise((resolve) => {
        if (signal.aborted) {
          resolve({ done: true, value: void 0 });
          return;
        }
        let onAbortRead = () => {
          resolve({ done: true, value: void 0 });
        };
        removeAbortReadListener = () => signal.removeEventListener("abort", onAbortRead);
        signal.addEventListener("abort", onAbortRead, { once: true });
      });
      let result = await Promise.race([reader.read(), abortRead]);
      removeAbortReadListener?.();
      if (result.done) {
        controller.close();
        return;
      }
      controller.enqueue(result.value);
    },
    cancel(reason) {
      signal.removeEventListener("abort", onAbort);
      return reader.cancel(reason);
    }
  });
}
function removeFrameDomRange(node, domParent) {
  removeDomRange(node._rangeStart, node._rangeEnd, domParent);
}
function removeDomRange(start, end, domParent) {
  let cursor = start;
  while (cursor) {
    let nextSibling = cursor.nextSibling;
    if (cursor.parentNode === domParent) {
      domParent.removeChild(cursor);
    }
    if (cursor === end)
      break;
    cursor = nextSibling;
  }
}
function getFrameRuntime(frame) {
  let runtime = frame.$runtime;
  return isFrameRuntime(runtime) ? runtime : void 0;
}
function getFrameSrc(node) {
  return node.props.src;
}
function getFrameName(node) {
  let name = node.props.name;
  return typeof name === "string" && name.length > 0 ? name : void 0;
}
function randomFrameId() {
  return `f${crypto.randomUUID().slice(0, 8)}`;
}
function skipCommentsExceptBoundaryStart(cursor, preserveClientEntry) {
  while (cursor && cursor.nodeType === Node.COMMENT_NODE) {
    if (isFrameStartComment(cursor))
      return cursor;
    if (preserveClientEntry && isCommentNode(cursor) && cursor.data.trim().startsWith("rmx:h:")) {
      return cursor;
    }
    cursor = cursor.nextSibling;
  }
  return cursor;
}
function isFrameStartComment(node) {
  return isCommentNode(node) && node.data.trim().startsWith("rmx:f:");
}
function isFrameEndComment(node) {
  return isCommentNode(node) && node.data.trim() === "/rmx:f";
}
function isCommentNode(node) {
  return node?.nodeType === Node.COMMENT_NODE;
}
function findFrameEndComment(start) {
  let depth = 1;
  let node = start.nextSibling;
  while (node) {
    if (isFrameStartComment(node))
      depth++;
    else if (isFrameEndComment(node)) {
      depth--;
      if (depth === 0)
        return node;
    }
    node = node.nextSibling;
  }
  return null;
}
function renderComponent(currContent, next, domParent, context, anchor, cursor) {
  let { scheduler } = context;
  let handle = next._handle;
  if (handle.isRemoved()) {
    invariant("_content" in next, "Expected removed component to be committed");
    return next;
  }
  let [element, tasks] = handle.render(next.props);
  let content = diffVNodes(currContent, toVNode(element), domParent, next, context, anchor, cursor);
  let committed = commitComponentNode(next, content);
  handle.setScheduleUpdate(scheduler, committed, domParent);
  scheduler.enqueueTasks(tasks);
  return committed;
}
function diffComponent(curr, next, domParent, vParent, context, svg, anchor, cursor) {
  let { frame } = context;
  if (curr === null) {
    let componentId = vParent.kind === "root" ? vParent._pendingHydrationComponentId : void 0;
    if (componentId) {
      if (vParent.kind === "root")
        vParent._pendingHydrationComponentId = void 0;
    } else {
      componentId = `c${++idCounter}`;
    }
    let handle = createComponent({
      id: componentId,
      frame,
      type: next.type,
      getContext: (type) => findContextFromAncestry(vParent, type),
      getFrameByName(name) {
        let runtime = getFrameRuntime(frame);
        return runtime?.namedFrames.get(name);
      },
      getTopFrame() {
        let runtime = getFrameRuntime(frame);
        return runtime?.topFrame;
      }
    });
    let mounting2 = beginComponentNode(next, vParent, svg, handle, context);
    return renderComponent(null, mounting2, domParent, context, anchor, cursor);
  }
  let mounting = beginComponentNode(next, vParent, svg, curr._handle, context);
  return renderComponent(curr._content, mounting, domParent, context, anchor, cursor);
}
function commitClientEntryBoundary(node, parent, svg, start, end) {
  return {
    kind: "client-entry",
    type: node.type,
    key: node.key,
    props: node.props,
    _parent: parent,
    _svg: svg,
    _rangeStart: start,
    _rangeEnd: end
  };
}
function updateClientEntryBoundary(node, context) {
  let element = jsx(node.type, node.props, node.key);
  let owner = getClientEntryBoundaryOwner(node._rangeStart);
  if (owner) {
    owner.root.render(element);
    return;
  }
  let runtime = getFrameRuntime(context.frame);
  let pending = runtime?.pendingClientEntries.get(node._rangeStart);
  invariant(runtime && pending?.[0] === node._rangeEnd, "Expected pending client entry boundary");
  runtime.pendingClientEntries.set(node._rangeStart, [node._rangeEnd, element]);
}
function diffClientEntryBoundary(curr, next, parent, context) {
  let committed = commitClientEntryBoundary(next, parent, curr._svg, curr._rangeStart, curr._rangeEnd);
  updateClientEntryBoundary(committed, context);
  return committed;
}
function disposeCommittedClientEntryBoundary(node, context) {
  getFrameRuntime(context.frame)?.pendingClientEntries.delete(node._rangeStart);
  return disposeClientEntryBoundary(node._rangeStart);
}
function cleanupDescendants(node, context) {
  let { scheduler } = context;
  if (isCommittedTextNode(node)) {
    return;
  }
  if (isCommittedHostNode(node)) {
    let children = node._children;
    for (let i = 0; i < children.length; i++) {
      cleanupDescendants(children[i], context);
    }
    teardownMixins(node._mixState);
    abandonDirectEventListeners(node);
    abandonControlledReflection(node);
    return;
  }
  if (isFragmentNode(node)) {
    let children = node._children;
    for (let i = 0; i < children.length; i++) {
      cleanupDescendants(children[i], context);
    }
    return;
  }
  if (isCommittedComponentNode(node)) {
    cleanupDescendants(node._content, context);
    let tasks = node._handle.remove();
    scheduler.enqueueTasks(tasks);
    return;
  }
  if (isCommittedClientEntryNode(node)) {
    disposeCommittedClientEntryBoundary(node, context);
    return;
  }
  if (node.kind === "frame") {
    disposeFrameResources(node);
    return;
  }
}
function remove(node, domParent, context) {
  let { scheduler } = context;
  if (isCommittedTextNode(node)) {
    node._dom.parentNode?.removeChild(node._dom);
    return;
  }
  if (isCommittedHostNode(node)) {
    if (node._persistence)
      return;
    let persistedRemoval = prepareMixinRemoval(node._mixState);
    if (persistedRemoval) {
      let token = ++persistedRemovalToken;
      markNodePersistedByMixins(node, domParent, token);
      void persistedRemoval.catch(() => {
      }).finally(() => {
        if (!node._persistence)
          return;
        if (node._persistence.token !== token)
          return;
        unmarkNodePersistedByMixins(node);
        performHostNodeRemoval(node, domParent, context);
      });
      return;
    }
    performHostNodeRemoval(node, domParent, context);
    return;
  }
  if (isFragmentNode(node)) {
    let children = node._children;
    for (let i = 0; i < children.length; i++) {
      remove(children[i], domParent, context);
    }
    return;
  }
  if (isCommittedComponentNode(node)) {
    remove(node._content, domParent, context);
    let tasks = node._handle.remove();
    scheduler.enqueueTasks(tasks);
    return;
  }
  if (isCommittedClientEntryNode(node)) {
    if (disposeCommittedClientEntryBoundary(node, context)) {
      node._rangeStart.remove();
      node._rangeEnd.remove();
    } else {
      removeDomRange(node._rangeStart, node._rangeEnd, domParent);
    }
    return;
  }
  if (node.kind === "frame") {
    disposeFrameResources(node);
    removeFrameDomRange(node, domParent);
    return;
  }
}
function performHostNodeRemoval(node, domParent, context) {
  let children = node._children;
  if (isHeadHostNode(node)) {
    for (let i = 0; i < children.length; i++) {
      remove(children[i], node._dom, context);
    }
  } else {
    for (let i = 0; i < children.length; i++) {
      cleanupDescendants(children[i], context);
    }
  }
  teardownMixins(node._mixState);
  if (isHeadHostNode(node)) {
    teardownDirectEventListeners(node);
    teardownControlledReflection(node);
  } else {
    abandonDirectEventListeners(node);
    abandonControlledReflection(node);
    node._dom.parentNode?.removeChild(node._dom);
  }
}
function diffChildren(curr, next, domParent, vParent, context, cursor, anchor) {
  let hasKeys = hasKeyedChildren(next);
  let committed = next;
  if (curr === null) {
    if (hasKeys) {
      warnDuplicateKeys(next);
    }
    for (let i = 0; i < next.length; i++) {
      committed[i] = insert(next[i], domParent, vParent, context, anchor, cursor);
    }
    return committed;
  }
  if (curr.length > 0 && next.length === 0 && anchor === void 0 && !parentUsesInnerHTML(vParent) && canBulkClearChildren(curr)) {
    for (let i = 0; i < curr.length; i++) {
      cleanupDescendants(curr[i], context);
    }
    domParent.textContent = "";
    return EMPTY_COMMITTED_CHILDREN;
  }
  if (!hasKeys) {
    for (let i = 0; i < next.length; i++) {
      let currentNode = i < curr.length ? curr[i] : null;
      committed[i] = diffVNodes(currentNode, next[i], domParent, vParent, context, anchor, cursor);
    }
    if (curr.length > next.length) {
      for (let i = next.length; i < curr.length; i++) {
        let node = curr[i];
        if (node)
          remove(node, domParent, context);
      }
    }
    return committed;
  }
  return patchKeyedChildren(curr, next, domParent, vParent, context, cursor, anchor);
}
function parentUsesInnerHTML(parent) {
  return isHostNode(parent) && getHostProps(parent).innerHTML != null;
}
function canBulkClearChildren(children) {
  for (let i = 0; i < children.length; i++) {
    if (!canBulkClearNode(children[i]))
      return false;
  }
  return true;
}
function canBulkClearNode(node) {
  if (isCommittedTextNode(node))
    return true;
  if (isCommittedHostNode(node)) {
    if (node._mixState)
      return false;
    return canBulkClearChildren(node._children);
  }
  if (isFragmentNode(node)) {
    return canBulkClearChildren(node._children);
  }
  if (isCommittedComponentNode(node)) {
    return canBulkClearNode(node._content);
  }
  return false;
}
function hasKeyedChildren(children) {
  for (let i = 0; i < children.length; i++) {
    if (children[i].key != null)
      return true;
  }
  return false;
}
function warnDuplicateKeys(children) {
  let seenKeys;
  let duplicateKeys;
  for (let node of children) {
    if (node.key == null)
      continue;
    if (!seenKeys) {
      seenKeys = /* @__PURE__ */ new Set([node.key]);
      continue;
    }
    if (seenKeys.has(node.key)) {
      duplicateKeys ??= /* @__PURE__ */ new Set();
      duplicateKeys.add(node.key);
    } else {
      seenKeys.add(node.key);
    }
  }
  if (duplicateKeys?.size) {
    let quotedKeys = Array.from(duplicateKeys, (key) => `"${String(key)}"`);
    console.warn(`Duplicate keys detected in siblings: ${quotedKeys.join(", ")}. Keys should be unique.`);
  }
}
function patchKeyedChildren(curr, next, domParent, vParent, context, cursor, anchor) {
  let matches = matchKeyedChildrenInOrder(curr, next) ?? matchKeyedChildrenAfterSingleRemoval(curr, next) ?? matchKeyedChildrenAfterPairSwap(curr, next);
  if (!matches) {
    warnDuplicateKeys(next);
    matches = matchKeyedChildren(curr, next);
  }
  let committed = next;
  let matchAnalysis = analyzeKeyedChildMatches(curr.length, matches);
  if (matchAnalysis.hasRemovals) {
    let usedOldIndexes = new Uint8Array(curr.length);
    for (let index = 0; index < matches.length; index++) {
      let oldIndex = matches[index];
      if (oldIndex >= 0) {
        usedOldIndexes[oldIndex] = 1;
      }
    }
    for (let oldIndex = 0; oldIndex < curr.length; oldIndex++) {
      if (usedOldIndexes[oldIndex] === 0) {
        remove(curr[oldIndex], domParent, context);
      }
    }
  }
  for (let index = 0; index < next.length; index++) {
    let oldIndex = matches[index];
    let oldNode = oldIndex >= 0 ? curr[oldIndex] : null;
    committed[index] = diffVNodes(oldNode, next[index], domParent, vParent, context, anchor, cursor);
  }
  let committedChildren = committed;
  if (matchAnalysis.canSkipPlacement) {
    return committedChildren;
  }
  let stableIndexes = lisMatches(matches);
  let stableCursor = stableIndexes.length - 1;
  let placementAnchor = anchor ?? null;
  for (let index = next.length - 1; index >= 0; index--) {
    let nextNode = committedChildren[index];
    let isStable = stableIndexes[stableCursor] === index;
    if (isStable) {
      stableCursor--;
    } else {
      placeVNode(nextNode, domParent, placementAnchor);
    }
    placementAnchor = findFirstDomAnchor(nextNode) ?? placementAnchor;
  }
  return committedChildren;
}
function matchKeyedChildren(curr, next) {
  let oldKeyMap = /* @__PURE__ */ new Map();
  let usedOldIndexes = /* @__PURE__ */ new Set();
  let unkeyedSearchStart = 0;
  for (let index = 0; index < curr.length; index++) {
    let key = curr[index].key;
    if (key != null)
      oldKeyMap.set(key, index);
  }
  let matches = [];
  for (let nextIndex = 0; nextIndex < next.length; nextIndex++) {
    let nextNode = next[nextIndex];
    let oldIndex = -1;
    if (nextNode.key != null) {
      let keyedOldIndex = oldKeyMap.get(nextNode.key);
      if (keyedOldIndex !== void 0) {
        let oldNode = curr[keyedOldIndex];
        if (!usedOldIndexes.has(keyedOldIndex) && oldNode.type === nextNode.type) {
          oldIndex = keyedOldIndex;
        }
      }
    } else {
      for (let index = unkeyedSearchStart; index < curr.length; index++) {
        let oldNode = curr[index];
        if (usedOldIndexes.has(index) || oldNode.key != null || oldNode.type !== nextNode.type) {
          continue;
        }
        oldIndex = index;
        unkeyedSearchStart = index + 1;
        break;
      }
    }
    if (oldIndex >= 0)
      usedOldIndexes.add(oldIndex);
    matches.push(oldIndex);
  }
  return matches;
}
function matchKeyedChildrenInOrder(curr, next) {
  let length = Math.min(curr.length, next.length);
  let matches = [];
  for (let index = 0; index < length; index++) {
    let nextNode = next[index];
    if (nextNode.key == null)
      return null;
    let oldNode = curr[index];
    if (oldNode.key !== nextNode.key || oldNode.type !== nextNode.type) {
      return null;
    }
    matches.push(index);
  }
  for (let index = length; index < next.length; index++) {
    if (next[index].key == null)
      return null;
    matches.push(-1);
  }
  return matches;
}
function matchKeyedChildrenAfterSingleRemoval(curr, next) {
  if (curr.length !== next.length + 1)
    return null;
  let matches = [];
  let oldIndex = 0;
  let skippedOldNode = false;
  for (let nextIndex = 0; nextIndex < next.length; nextIndex++) {
    let nextNode = next[nextIndex];
    if (nextNode.key == null)
      return null;
    let oldNode = curr[oldIndex];
    if (oldNode.key === nextNode.key && oldNode.type === nextNode.type) {
      matches.push(oldIndex);
      oldIndex++;
      continue;
    }
    if (skippedOldNode)
      return null;
    skippedOldNode = true;
    oldIndex++;
    oldNode = curr[oldIndex];
    if (oldNode.key !== nextNode.key || oldNode.type !== nextNode.type) {
      return null;
    }
    matches.push(oldIndex);
    oldIndex++;
  }
  return matches;
}
function matchKeyedChildrenAfterPairSwap(curr, next) {
  if (curr.length !== next.length)
    return null;
  let matches = [];
  let firstMismatch = -1;
  let secondMismatch = -1;
  for (let index = 0; index < next.length; index++) {
    let nextNode = next[index];
    if (nextNode.key == null)
      return null;
    let oldNode = curr[index];
    if (oldNode.key === nextNode.key && oldNode.type === nextNode.type) {
      matches.push(index);
      continue;
    }
    if (firstMismatch === -1) {
      firstMismatch = index;
    } else if (secondMismatch === -1) {
      secondMismatch = index;
    } else {
      return null;
    }
    matches.push(-1);
  }
  if (firstMismatch === -1)
    return matches;
  if (secondMismatch === -1)
    return null;
  let firstOldNode = curr[firstMismatch];
  let secondOldNode = curr[secondMismatch];
  let firstNextNode = next[firstMismatch];
  let secondNextNode = next[secondMismatch];
  if (firstOldNode.key !== secondNextNode.key || firstOldNode.type !== secondNextNode.type || secondOldNode.key !== firstNextNode.key || secondOldNode.type !== firstNextNode.type) {
    return null;
  }
  matches[firstMismatch] = secondMismatch;
  matches[secondMismatch] = firstMismatch;
  return matches;
}
function analyzeKeyedChildMatches(currentLength, matches) {
  let hasRemovals = matches.length !== currentLength;
  let canSkipPlacement = true;
  let lastOldIndex = -1;
  let sawNewNode = false;
  for (let index = 0; index < matches.length; index++) {
    let oldIndex = matches[index];
    if (oldIndex < 0) {
      hasRemovals = true;
      sawNewNode = true;
      continue;
    }
    if (sawNewNode || oldIndex < lastOldIndex) {
      canSkipPlacement = false;
    }
    lastOldIndex = oldIndex;
  }
  return { hasRemovals, canSkipPlacement };
}
function lisMatches(matches) {
  let predecessors = Array.from({ length: matches.length });
  let tails = [];
  for (let index = 0; index < matches.length; index++) {
    let value = matches[index] + 1;
    if (value === 0)
      continue;
    let low = 0;
    let high = tails.length;
    while (low < high) {
      let middle = low + high >> 1;
      if (matches[tails[middle]] + 1 < value) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }
    predecessors[index] = low > 0 ? tails[low - 1] : -1;
    tails[low] = index;
  }
  let cursor = tails.at(-1) ?? -1;
  for (let index = tails.length - 1; index >= 0; index--) {
    tails[index] = cursor;
    cursor = predecessors[cursor] ?? -1;
  }
  return tails;
}
function placeVNode(node, domParent, anchor) {
  let firstDom = findFirstDomAnchor(node);
  if (!firstDom || firstDom.parentNode !== domParent)
    return;
  let lastDom = findLastDomAnchor(node);
  if (!lastDom)
    return;
  if (anchor && domRangeContainsNode(firstDom, lastDom, anchor))
    return;
  if (firstDom === anchor)
    return;
  moveDomRange(domParent, firstDom, lastDom, anchor);
}
function findFirstDomAnchor(node) {
  if (!node)
    return null;
  if (isCommittedTextNode(node))
    return node._dom;
  if (isCommittedHostNode(node))
    return node._dom;
  if (isCommittedComponentNode(node))
    return findFirstDomAnchor(node._content);
  if (isCommittedClientEntryNode(node))
    return node._rangeStart;
  if (node.kind === "frame")
    return node._rangeStart;
  if (isFragmentNode(node)) {
    let children = node._children;
    for (let i = 0; i < children.length; i++) {
      let dom = findFirstDomAnchor(children[i]);
      if (dom)
        return dom;
    }
  }
  return null;
}
function findLastDomAnchor(node) {
  if (!node)
    return null;
  if (isCommittedTextNode(node))
    return node._dom;
  if (isCommittedHostNode(node))
    return node._dom;
  if (isCommittedComponentNode(node))
    return findLastDomAnchor(node._content);
  if (isCommittedClientEntryNode(node))
    return node._rangeEnd;
  if (node.kind === "frame")
    return node._rangeEnd;
  if (isFragmentNode(node)) {
    for (let i = node._children.length - 1; i >= 0; i--) {
      let dom = findLastDomAnchor(node._children[i]);
      if (dom)
        return dom;
    }
  }
  return null;
}
function domRangeContainsNode(first, last, node) {
  let current = first;
  while (current) {
    if (current === node)
      return true;
    if (current === last)
      break;
    current = current.nextSibling;
  }
  return false;
}
function moveDomRange(domParent, first, last, before) {
  let current = first;
  while (current) {
    let next = current === last ? null : current.nextSibling;
    domParent.insertBefore(current, before);
    if (current === last)
      break;
    current = next;
  }
}
function setActiveSchedulerUpdateParents(parents) {
  activeSchedulerUpdateParents = parents;
}
function shouldDispatchInlineMixinLifecycle(node) {
  let parents = activeSchedulerUpdateParents;
  if (!parents?.length)
    return true;
  for (let parent of parents) {
    if (!(parent instanceof Node))
      continue;
    let parentNode = parent;
    if (parentNode === node)
      return false;
    if (parentNode.contains(node))
      return false;
  }
  return true;
}
function findNextSiblingDomAnchor(curr) {
  let vParent = curr._parent;
  if (vParent.kind === "component")
    return findNextSiblingDomAnchor(vParent);
  let children = vParent._children;
  if (children.length === 0) {
    if (vParent.kind === "root")
      return vParent._rangeEnd ?? null;
    if (vParent.kind === "fragment")
      return findNextSiblingDomAnchor(vParent);
    return null;
  }
  let idx = children.indexOf(curr);
  if (idx === -1)
    return null;
  for (let i = idx + 1; i < children.length; i++) {
    let dom = findFirstDomAnchor(children[i]);
    if (dom)
      return dom;
  }
  if (isFragmentNode(vParent)) {
    return findNextSiblingDomAnchor(vParent);
  }
  return vParent.kind === "root" ? vParent._rangeEnd ?? null : null;
}
function reclaimPersistedMixinNode(persistedNode, newNode, vParent, context) {
  let { frame, scheduler, styles } = context;
  cancelPendingMixinRemoval(persistedNode._mixState);
  unmarkNodePersistedByMixins(persistedNode);
  let prevProps = getHostProps(persistedNode);
  let childInputs = newNode._children;
  let resolved = resolveNodeMixProps(newNode, vParent, frame, scheduler, persistedNode._mixState);
  let nextProps = resolved.props;
  let committed = commitHostNode(newNode, vParent, getSvgContext(vParent, newNode), persistedNode._dom, resolved);
  committed._directEventState = persistedNode._directEventState;
  committed._controlledState = persistedNode._controlledState;
  if (shouldDispatchInlineMixinLifecycle(persistedNode._dom)) {
    dispatchMixinBeforeUpdate(committed._mixState);
  }
  patchHostProps(prevProps, nextProps, persistedNode._dom);
  syncDirectEventListeners(committed);
  ensureControlledReflection(committed, scheduler);
  syncControlledReflection(committed, nextProps);
  committed._children = diffChildren(persistedNode._children, childInputs, persistedNode._dom, committed, context);
  if (committed._mixState) {
    bindNodeMixRuntime(committed, frame, scheduler, styles, true);
  }
  if (shouldDispatchInlineMixinLifecycle(persistedNode._dom)) {
    scheduler.enqueueCommitPhase([() => dispatchMixinCommit(committed._mixState)]);
  }
  return committed;
}

// node_modules/@remix-run/component/dist/style/layers.js
var REMIX_UI_STYLE_LAYER = "rmx";

// node_modules/@remix-run/component/dist/style/stylesheet.js
var SERVER_STYLE_SELECTOR = "style[data-rmx-style]";
function getStyleLayerName(className, layer = REMIX_UI_STYLE_LAYER) {
  return `${layer}.${className}`;
}
function compareNodesInDocumentOrder(a, b) {
  if (a === b)
    return 0;
  let position = a.compareDocumentPosition(b);
  if (position & Node.DOCUMENT_POSITION_FOLLOWING)
    return -1;
  if (position & Node.DOCUMENT_POSITION_PRECEDING)
    return 1;
  return 0;
}
function isParentNode(value) {
  return "querySelectorAll" in value;
}
function collectServerStyleTagsFromNode(node, into) {
  if (isHtmlStyleElement(node) && node.matches(SERVER_STYLE_SELECTOR)) {
    into.add(node);
    return;
  }
  if (!(node instanceof Element) && !(node instanceof Document) && !(node instanceof DocumentFragment)) {
    return;
  }
  let nested = node.querySelectorAll?.(SERVER_STYLE_SELECTOR) ?? [];
  for (let i = 0; i < nested.length; i++) {
    let el = nested[i];
    if (isHtmlStyleElement(el)) {
      into.add(el);
    }
  }
}
function collectServerStyleTags(source) {
  let styles = /* @__PURE__ */ new Set();
  if (isParentNode(source)) {
    collectServerStyleTagsFromNode(source, styles);
  } else {
    for (let node of source) {
      collectServerStyleTagsFromNode(node, styles);
    }
  }
  return Array.from(styles).sort(compareNodesInDocumentOrder);
}
function isHtmlStyleElement(node) {
  return typeof node === "object" && node !== null && node instanceof HTMLStyleElement;
}
function getStyleSelector(styleEl) {
  let selector = styleEl.getAttribute("data-rmx-style")?.trim();
  return selector ? selector : null;
}
function createStyleManager(layer = REMIX_UI_STYLE_LAYER) {
  let stylesheet = null;
  let generation = 0;
  let ruleMap = /* @__PURE__ */ new Map();
  function getStylesheet() {
    if (!stylesheet) {
      stylesheet = new CSSStyleSheet();
      document.adoptedStyleSheets.push(stylesheet);
    }
    return stylesheet;
  }
  function removeStylesheet() {
    if (!stylesheet)
      return;
    document.adoptedStyleSheets = Array.from(document.adoptedStyleSheets).filter((s) => s !== stylesheet);
    stylesheet = null;
  }
  function clearStylesheet() {
    if (!stylesheet)
      return;
    for (let i = stylesheet.cssRules.length - 1; i >= 0; i--) {
      stylesheet.deleteRule(i);
    }
  }
  function adoptServerStyleTag(styleEl) {
    let selector = getStyleSelector(styleEl);
    if (!selector)
      return void 0;
    let entry = ruleMap.get(selector);
    if (entry) {
      entry.pinned = true;
      styleEl.remove();
      return selector;
    }
    let cssText = styleEl.textContent?.trim() ?? "";
    if (cssText.length === 0) {
      styleEl.remove();
      return void 0;
    }
    try {
      let sheet = getStylesheet();
      let index = sheet.cssRules.length;
      sheet.insertRule(cssText, index);
      ruleMap.set(selector, { count: 0, index, pinned: true });
      styleEl.remove();
      return selector;
    } catch {
      return void 0;
    }
  }
  function has(className) {
    let entry = ruleMap.get(className);
    return entry !== void 0 && (entry.pinned || entry.count > 0);
  }
  function getGeneration() {
    return generation;
  }
  function insert2(className, rule) {
    let entry = ruleMap.get(className);
    if (entry) {
      if (!entry.pinned)
        entry.count++;
      return;
    }
    let sheet = getStylesheet();
    let index = sheet.cssRules.length;
    sheet.insertRule(`@layer ${getStyleLayerName(className, layer)} { ${rule} }`, index);
    ruleMap.set(className, { count: 1, index, pinned: false });
  }
  function remove2(className) {
    let entry = ruleMap.get(className);
    if (!entry || entry.pinned)
      return;
    entry.count--;
    if (entry.count > 0) {
      return;
    }
    let indexToDelete = entry.index;
    ruleMap.delete(className);
    if (!stylesheet)
      return;
    stylesheet.deleteRule(indexToDelete);
    for (let [, data] of ruleMap.entries()) {
      if (data.index > indexToDelete) {
        data.index--;
      }
    }
  }
  function reset() {
    clearStylesheet();
    ruleMap.clear();
    removeStylesheet();
    generation++;
  }
  function adoptServerStyles(source) {
    let styles = collectServerStyleTags(source);
    let adopted = /* @__PURE__ */ new Set();
    for (let styleEl of styles) {
      let selector = adoptServerStyleTag(styleEl);
      if (selector)
        adopted.add(selector);
    }
    return adopted;
  }
  function selectors() {
    return ruleMap.keys();
  }
  function dispose() {
    removeStylesheet();
    ruleMap.clear();
    generation++;
  }
  return {
    insert: insert2,
    remove: remove2,
    has,
    getGeneration,
    reset,
    adoptServerStyles,
    selectors,
    dispose
  };
}

// node_modules/@remix-run/component/dist/runtime/diff-props.js
var globalStyleManager = typeof window !== "undefined" ? createStyleManager() : null;
var defaultStyleManager = globalStyleManager;

// node_modules/@remix-run/component/dist/runtime/scheduler.js
var CASCADING_UPDATE_WARN_THRESHOLD = 50;
var MAX_CASCADING_COMPONENT_UPDATES = 50;
function getComponentName(vnode) {
  return vnode.type.name || "Anonymous";
}
function formatComponentCounts(counts) {
  return Array.from(counts, ([name, count]) => `${name} x${count}`).join(", ");
}
function createScheduler(doc, rootTarget, styles = defaultStyleManager) {
  let documentState = createDocumentState(doc);
  let scheduled = /* @__PURE__ */ new Map();
  let workTasks = [];
  let commitPhaseTasks = [];
  let postCommitTasks = [];
  let flushScheduled = false;
  let flushing = false;
  let cascadingComponentUpdateCount = 0;
  let cascadingComponentUpdateCounts = /* @__PURE__ */ new WeakMap();
  let cascadingComponentNameCounts = /* @__PURE__ */ new Map();
  let warnedAboutCascadingUpdates = false;
  let resetScheduled = false;
  let phaseEvents = new EventTarget();
  let phaseListenerCounts = {
    beforeUpdate: 0,
    commit: 0
  };
  let scheduler;
  function dispatchError(error) {
    console.error(error);
    rootTarget.dispatchEvent(createComponentErrorEvent(error));
  }
  function scheduleCounterReset() {
    if (resetScheduled)
      return;
    resetScheduled = true;
    setTimeout(() => {
      cascadingComponentUpdateCount = 0;
      cascadingComponentUpdateCounts = /* @__PURE__ */ new WeakMap();
      cascadingComponentNameCounts = /* @__PURE__ */ new Map();
      warnedAboutCascadingUpdates = false;
      resetScheduled = false;
    }, 0);
  }
  function trackCascadingUpdate(vnode) {
    cascadingComponentUpdateCount++;
    let componentName = getComponentName(vnode);
    cascadingComponentNameCounts.set(componentName, (cascadingComponentNameCounts.get(componentName) ?? 0) + 1);
    let componentUpdateCount = (cascadingComponentUpdateCounts.get(vnode) ?? 0) + 1;
    cascadingComponentUpdateCounts.set(vnode, componentUpdateCount);
    scheduleCounterReset();
    if (!warnedAboutCascadingUpdates && cascadingComponentUpdateCount >= CASCADING_UPDATE_WARN_THRESHOLD) {
      warnedAboutCascadingUpdates = true;
      console.warn(`${cascadingComponentUpdateCount} cascading component updates detected in one event loop turn. Consider reducing hydration regions. Components: ${formatComponentCounts(cascadingComponentNameCounts)}`);
    }
    if (componentUpdateCount > MAX_CASCADING_COMPONENT_UPDATES) {
      let error = new Error(`handle.update() infinite loop detected in ${componentName} after ${componentUpdateCount} cascading updates. Components: ${formatComponentCounts(cascadingComponentNameCounts)}`);
      dispatchError(error);
      return false;
    }
    return true;
  }
  function flush() {
    if (flushing)
      return;
    flushing = true;
    try {
      while (true) {
        flushScheduled = false;
        let batch = new Map(scheduled);
        scheduled.clear();
        let hasWork = batch.size > 0 || workTasks.length > 0 || commitPhaseTasks.length > 0 || postCommitTasks.length > 0;
        if (!hasWork)
          return;
        documentState.capture();
        let updateParents = batch.size > 0 ? Array.from(new Set(batch.values())) : [];
        setActiveSchedulerUpdateParents(updateParents);
        dispatchPhaseEvent("beforeUpdate", updateParents);
        if (batch.size > 0) {
          let vnodes = Array.from(batch);
          let noScheduledAncestor = /* @__PURE__ */ new Set();
          for (let [vnode, domParent] of vnodes) {
            if (ancestorIsScheduled(vnode, batch, noScheduledAncestor))
              continue;
            if (!trackCascadingUpdate(vnode))
              return;
            let curr = vnode._content;
            let anchor = findNextSiblingDomAnchor(vnode) || void 0;
            try {
              renderComponent(curr, vnode, domParent, vnode._context, anchor);
            } catch (error) {
              dispatchError(error);
            }
          }
        }
        flushTaskQueue(workTasks);
        setActiveSchedulerUpdateParents(void 0);
        documentState.restore();
        flushTaskQueue(commitPhaseTasks);
        dispatchPhaseEvent("commit", updateParents);
        flushTaskQueue(postCommitTasks);
      }
    } finally {
      setActiveSchedulerUpdateParents(void 0);
      flushing = false;
    }
  }
  function dispatchPhaseEvent(type, parents) {
    if (phaseListenerCounts[type] === 0)
      return;
    let event = Object.assign(new Event(type), { parents });
    phaseEvents.dispatchEvent(event);
  }
  function flushTaskQueue(queue) {
    while (queue.length > 0) {
      let task = queue.shift();
      if (!task)
        continue;
      try {
        task();
      } catch (error) {
        dispatchError(error);
      }
    }
  }
  function scheduleFlush() {
    if (flushScheduled || flushing)
      return;
    flushScheduled = true;
    queueMicrotask(flush);
  }
  function ancestorIsScheduled(vnode, batch, safe) {
    let path = [];
    let current = vnode._parent;
    while (current) {
      if (safe.has(current)) {
        for (let node of path)
          safe.add(node);
        return false;
      }
      path.push(current);
      if (isCommittedComponentNode(current) && batch.has(current)) {
        return true;
      }
      current = current.kind === "root" ? void 0 : current._parent;
    }
    for (let node of path)
      safe.add(node);
    return false;
  }
  scheduler = {
    enqueue(vnode, domParent) {
      scheduled.set(vnode, domParent);
      scheduleFlush();
    },
    enqueueWork(newTasks) {
      workTasks.push(...newTasks);
      scheduleFlush();
    },
    enqueueCommitPhase(newTasks) {
      commitPhaseTasks.push(...newTasks);
      scheduleFlush();
    },
    enqueueTasks(newTasks) {
      postCommitTasks.push(...newTasks);
      scheduleFlush();
    },
    addEventListener(type, listener, options) {
      if (listener)
        phaseListenerCounts[type]++;
      phaseEvents.addEventListener(type, listener, options);
    },
    removeEventListener(type, listener, options) {
      if (listener)
        phaseListenerCounts[type] = Math.max(0, phaseListenerCounts[type] - 1);
      phaseEvents.removeEventListener(type, listener, options);
    },
    dequeue() {
      flush();
    }
  };
  return scheduler;
}

// node_modules/@remix-run/component/dist/runtime/vdom.js
function getHydrationComponentIdFromRangeStart(start) {
  if (!(start instanceof Comment))
    return void 0;
  let marker = start.data.trim();
  if (!marker.startsWith("rmx:h:"))
    return void 0;
  let id = marker.slice("rmx:h:".length);
  return id.length > 0 ? id : void 0;
}
function createRangeRoot(boundaries, options = {}) {
  let [start, end] = boundaries;
  let vroot = null;
  let currentElement;
  let styles = options.styleManager ?? defaultStyleManager;
  let container = end.parentNode;
  invariant(container, "Expected parent node");
  invariant(start.parentNode === container, "Boundaries must share parent");
  let parent = container;
  let hydrationCursor = start.nextSibling;
  let eventTarget = new TypedEventTarget();
  let scheduler = options.scheduler ?? createScheduler(parent.ownerDocument ?? document, eventTarget, styles);
  let frameStub = options.frame ?? createRootFrameHandle({
    src: options.frameInit?.src,
    resolveFrame: options.frameInit?.resolveFrame,
    loadModule: options.frameInit?.loadModule,
    errorTarget: eventTarget,
    scheduler,
    styleManager: styles
  });
  let context = {
    frame: frameStub,
    scheduler,
    styles,
    rootTarget: eventTarget
  };
  let isErrorForwardingAttached = false;
  function forwardDomError(event) {
    eventTarget.dispatchEvent(createComponentErrorEvent(getComponentError(event)));
  }
  function attachDomErrorForwarding() {
    if (isErrorForwardingAttached)
      return;
    parent.addEventListener("error", forwardDomError);
    isErrorForwardingAttached = true;
  }
  function detachDomErrorForwarding() {
    if (!isErrorForwardingAttached)
      return;
    parent.removeEventListener("error", forwardDomError);
    isErrorForwardingAttached = false;
  }
  attachDomErrorForwarding();
  let root = Object.assign(eventTarget, {
    render(element) {
      attachDomErrorForwarding();
      currentElement = element;
      let vnode = toVNode(element);
      let vParent = {
        kind: "root",
        type: ROOT_VNODE,
        _children: [],
        _svg: false,
        _getContext: options.getContext,
        _rangeStart: start,
        _rangeEnd: end,
        _pendingHydrationComponentId: getHydrationComponentIdFromRangeStart(start)
      };
      scheduler.enqueueWork([
        () => {
          let cursor = hydrationCursor === null ? void 0 : { current: hydrationCursor };
          let committed = diffVNodes(vroot, vnode, parent, vParent, context, end, cursor);
          vParent._children = [committed];
          vroot = committed;
          hydrationCursor = null;
        }
      ]);
      scheduler.dequeue();
    },
    reconcile() {
      if (currentElement === void 0)
        return;
      root.render(currentElement);
    },
    dispose() {
      detachDomErrorForwarding();
      unregisterRoot(root);
      currentElement = void 0;
      if (!vroot)
        return;
      let current = vroot;
      vroot = null;
      scheduler.enqueueWork([() => remove(current, parent, context)]);
      scheduler.dequeue();
    },
    flush() {
      scheduler.dequeue();
    }
  });
  registerRoot(root);
  return root;
}
function createRoot(container, options = {}) {
  let vroot = null;
  let currentElement;
  let styles = options.styleManager ?? defaultStyleManager;
  if (container.innerHTML.trim() !== "") {
    styles.adoptServerStyles(container);
  }
  let hydrationCursor = container.innerHTML.trim() !== "" ? container.firstChild : void 0;
  let eventTarget = new TypedEventTarget();
  let scheduler = options.scheduler ?? createScheduler(container.ownerDocument ?? document, eventTarget, styles);
  let frameStub = options.frame ?? createRootFrameHandle({
    src: options.frameInit?.src,
    resolveFrame: options.frameInit?.resolveFrame,
    loadModule: options.frameInit?.loadModule,
    errorTarget: eventTarget,
    scheduler,
    styleManager: styles
  });
  let context = {
    frame: frameStub,
    scheduler,
    styles,
    rootTarget: eventTarget
  };
  let isErrorForwardingAttached = false;
  function forwardDomError(event) {
    eventTarget.dispatchEvent(createComponentErrorEvent(getComponentError(event)));
  }
  function attachDomErrorForwarding() {
    if (isErrorForwardingAttached)
      return;
    container.addEventListener("error", forwardDomError);
    isErrorForwardingAttached = true;
  }
  function detachDomErrorForwarding() {
    if (!isErrorForwardingAttached)
      return;
    container.removeEventListener("error", forwardDomError);
    isErrorForwardingAttached = false;
  }
  attachDomErrorForwarding();
  let root = Object.assign(eventTarget, {
    render(element) {
      attachDomErrorForwarding();
      currentElement = element;
      let vnode = toVNode(element);
      let vParent = {
        kind: "root",
        type: ROOT_VNODE,
        _children: [],
        _svg: false,
        _getContext: options.getContext
      };
      scheduler.enqueueWork([
        () => {
          let cursor = hydrationCursor === void 0 ? void 0 : { current: hydrationCursor };
          let committed = diffVNodes(vroot, vnode, container, vParent, context, void 0, cursor);
          vParent._children = [committed];
          vroot = committed;
          hydrationCursor = void 0;
        }
      ]);
      scheduler.dequeue();
    },
    reconcile() {
      if (currentElement === void 0)
        return;
      root.render(currentElement);
    },
    dispose() {
      detachDomErrorForwarding();
      unregisterRoot(root);
      currentElement = void 0;
      if (!vroot)
        return;
      let current = vroot;
      vroot = null;
      scheduler.enqueueWork([() => remove(current, container, context)]);
      scheduler.dequeue();
    },
    flush() {
      scheduler.dequeue();
    }
  });
  registerRoot(root);
  return root;
}
function createRootFrameHandle(init) {
  let resolveFrame = init.resolveFrame ?? (() => {
    throw new Error("Cannot render <Frame /> without frame runtime. Use run() or pass frameInit to createRoot/createRangeRoot.");
  });
  let runtime = createFrameRuntime({
    topFrame: void 0,
    loadModule: init.loadModule ?? (() => {
      throw new Error("loadModule is required to hydrate client entries inside <Frame />");
    }),
    resolveFrame,
    errorTarget: init.errorTarget,
    pendingClientEntries: /* @__PURE__ */ new Map(),
    scheduler: init.scheduler,
    styleManager: init.styleManager,
    moduleCache: /* @__PURE__ */ new Map(),
    moduleLoads: /* @__PURE__ */ new Map(),
    frameInstances: /* @__PURE__ */ new WeakMap(),
    namedFrames: new NamedFrameRegistry()
  });
  runtime.canResolveFrames = !!init.resolveFrame;
  let frame = createFrameHandle({ src: init.src ?? "/", $runtime: runtime });
  runtime.topFrame = frame;
  return frame;
}

// node_modules/@remix-run/component/dist/runtime/diff-dom.js
var REMIX_PRESERVE_DOM_ATTRIBUTE = "data-rmx-preserve-dom";
function diffNodes(curr, next, context) {
  let parent = curr[0]?.parentNode ?? context.regionParent ?? null;
  invariant(parent, "Parent node not found");
  let regionTailRef = context.regionTailRef ?? (curr.length > 0 ? curr[curr.length - 1].nextSibling : null);
  diffSiblingUnits(curr, next, parent, regionTailRef, context);
}
function diffNode(current, next, context) {
  if (isTextNode(current) && isTextNode(next)) {
    let newText = next.textContent || "";
    if (current.textContent !== newText)
      current.textContent = newText;
    return;
  }
  if (isVirtualRootStartMarker(current) && isVirtualRootStartMarker(next)) {
    let nextData = next.data;
    if (current.data !== nextData) {
      current.data = nextData;
    }
    let end = findHydrationEndMarker(next);
    return end;
  }
  if (isCommentNode2(current) && isCommentNode2(next) && markerKindsMatch(current, next)) {
    let newData = next.data;
    let updated = false;
    if (isFrameStartMarker(current)) {
      if (shouldPreserveFrameStartMarker(current, next, context)) {
        if (current.data !== newData) {
          current.data = newData;
        }
        updated = true;
        let frame = context.frameInstances.get(current);
        let nextMarkerData = getFrameMarkerData(next, context);
        if (frame && nextMarkerData) {
          if (nextMarkerData.status === "resolved") {
            let nextEnd = findFrameEndMarker(next);
            let nextContent = collectFrameContentFragment(current.ownerDocument, next, nextEnd);
            let render = frame.renderMarkerContent({ ...nextMarkerData, id: getFrameId(next) }, nextContent, {
              data: context.data,
              signal: context.signal,
              reconciliationTracker: context.reconciliationTracker
            });
            if (context.reconciliationTracker)
              context.reconciliationTracker.waitFor(render);
            else
              void render;
            return nextEnd;
          }
          if (frame.isDisplayingResolvedContent()) {
            return findFrameEndMarker(next);
          }
        }
      } else if (current.data !== newData) {
        disposeFrameStartMarker(current, context);
        current.data = newData;
        updated = true;
      }
    }
    if (!updated && current.data !== newData) {
      current.data = newData;
    }
    return;
  }
  if (isElement(current) && isElement(next)) {
    if (current.tagName !== next.tagName) {
      let parent2 = current.parentNode;
      if (parent2) {
        parent2.insertBefore(next, current);
        removeNode(current, parent2, context);
      }
      return;
    }
    if (shouldPreserveDomElement(current, next))
      return;
    diffElementAttributes(current, next);
    if (shouldPreserveElementChildren(current, next))
      return;
    diffElementChildren(current, next, context);
    return;
  }
  let parent = current.parentNode;
  if (parent) {
    parent.insertBefore(next, current);
    removeNode(current, parent, context);
  }
}
function diffElementAttributes(current, next) {
  let prevAttrNames = current.getAttributeNames();
  let nextAttrNames = next.getAttributeNames();
  let preservedNames = next.getAttribute("data-rmx-preserve-attrs")?.split(/[\t\n\f\r ]+/);
  let nextNameSet = new Set(nextAttrNames);
  for (let name of prevAttrNames) {
    if (preservedNames?.includes(name))
      continue;
    if (!nextNameSet.has(name)) {
      if (shouldPreserveLiveAttribute(current, next, name))
        continue;
      current.removeAttribute(name);
    }
  }
  for (let name of nextAttrNames) {
    if (preservedNames?.includes(name))
      continue;
    let prevVal = current.getAttribute(name);
    let nextVal = next.getAttribute(name);
    if (prevVal !== nextVal) {
      if (shouldPreserveLiveAttribute(current, next, name))
        continue;
      current.setAttribute(name, nextVal == null ? "" : String(nextVal));
    }
  }
}
function shouldPreserveDomElement(current, next) {
  if (!next.hasAttribute(REMIX_PRESERVE_DOM_ATTRIBUTE))
    return false;
  if (!current.hasAttribute(REMIX_PRESERVE_DOM_ATTRIBUTE)) {
    current.setAttribute(REMIX_PRESERVE_DOM_ATTRIBUTE, "");
  }
  return true;
}
function shouldPreserveLiveAttribute(current, next, name) {
  if (name === "open") {
    if (current instanceof HTMLDetailsElement && next instanceof HTMLDetailsElement) {
      return current.open !== next.open;
    }
    if (current instanceof HTMLDialogElement && next instanceof HTMLDialogElement) {
      return current.open !== next.open;
    }
  }
  if (name === "checked") {
    if (current instanceof HTMLInputElement && next instanceof HTMLInputElement) {
      return current.checked !== next.checked;
    }
  }
  if (name === "value") {
    if (current instanceof HTMLInputElement && next instanceof HTMLInputElement && shouldPreserveInputValue(current)) {
      return current.value !== next.value;
    }
  }
  if (name === "selected") {
    if (current instanceof HTMLOptionElement && next instanceof HTMLOptionElement) {
      return current.selected !== next.selected;
    }
  }
  if (name === "popover") {
    return isPopoverOpen(current) !== isPopoverOpen(next);
  }
  return false;
}
function shouldPreserveElementChildren(current, next) {
  if (current instanceof HTMLTextAreaElement && next instanceof HTMLTextAreaElement) {
    return current.value !== next.value;
  }
  return false;
}
function shouldPreserveInputValue(input) {
  return input.type !== "button" && input.type !== "checkbox" && input.type !== "hidden" && input.type !== "image" && input.type !== "radio" && input.type !== "reset" && input.type !== "submit";
}
function isPopoverOpen(element) {
  try {
    return element.matches(":popover-open");
  } catch {
    return false;
  }
}
function diffElementChildren(current, next, context) {
  let shouldPreserveHeadNode = context.shouldPreserveHeadNode;
  let preservedHeadNodes = [];
  let currentChildren = Array.from(current.childNodes);
  if (current === current.ownerDocument.head && shouldPreserveHeadNode) {
    preservedHeadNodes = currentChildren.filter(shouldPreserveHeadNode);
    currentChildren = currentChildren.filter((node) => !shouldPreserveHeadNode(node));
  }
  let nextChildren = Array.from(next.childNodes);
  diffSiblingUnits(currentChildren, nextChildren, current, preservedHeadNodes[0] ?? null, context);
}
function diffSiblingUnits(currentNodes, nextNodes, parent, regionTailRef, context) {
  let currentUnits = parseSiblingUnits(currentNodes);
  let nextUnits = parseSiblingUnits(nextNodes);
  let keyToIndex = /* @__PURE__ */ new Map();
  for (let i = 0; i < currentUnits.length; i++) {
    let key = getSiblingUnitKey(currentUnits[i]);
    if (key !== void 0)
      keyToIndex.set(key, i);
  }
  let used = new Array(currentUnits.length).fill(false);
  let matchIndexForNext = new Array(nextUnits.length).fill(-1);
  for (let i = 0; i < nextUnits.length; i++) {
    let nextUnit = nextUnits[i];
    let matchIndex = -1;
    let key = getSiblingUnitKey(nextUnit);
    if (key !== void 0) {
      let keyedIndex = keyToIndex.get(key);
      if (keyedIndex !== void 0 && !used[keyedIndex] && siblingUnitsComparable(currentUnits[keyedIndex], nextUnit)) {
        matchIndex = keyedIndex;
      }
    }
    if (matchIndex === -1 && nextUnit.kind !== "node") {
      for (let j = 0; j < currentUnits.length; j++) {
        let currentUnit = currentUnits[j];
        if (used[j] || currentUnit.kind !== nextUnit.kind)
          continue;
        if (shouldPreserveBoundaryUnit(currentUnit, nextUnit, context)) {
          matchIndex = j;
          break;
        }
      }
    }
    if (matchIndex !== -1)
      used[matchIndex] = true;
    matchIndexForNext[i] = matchIndex;
  }
  let remainingCurrentIndexes = [];
  for (let i = 0; i < currentUnits.length; i++) {
    if (!used[i])
      remainingCurrentIndexes.push(i);
  }
  let remainingNextIndexes = [];
  for (let i = 0; i < nextUnits.length; i++) {
    if (matchIndexForNext[i] === -1)
      remainingNextIndexes.push(i);
  }
  let remainingLength = Math.min(remainingCurrentIndexes.length, remainingNextIndexes.length);
  for (let i = 0; i < remainingLength; i++) {
    let currentIndex = remainingCurrentIndexes[i];
    let nextIndex = remainingNextIndexes[i];
    let currentUnit = currentUnits[currentIndex];
    let nextUnit = nextUnits[nextIndex];
    if (currentUnit.kind !== "node" || nextUnit.kind !== "node" || getSiblingUnitKey(currentUnit) !== void 0 || getSiblingUnitKey(nextUnit) !== void 0 || !siblingUnitsComparable(currentUnit, nextUnit)) {
      continue;
    }
    used[currentIndex] = true;
    matchIndexForNext[nextIndex] = currentIndex;
  }
  let committed = new Array(nextUnits.length);
  for (let i = 0; i < nextUnits.length; i++) {
    let matchIndex = matchIndexForNext[i];
    let nextUnit = nextUnits[i];
    if (matchIndex === -1) {
      committed[i] = nextUnit;
      continue;
    }
    let currentUnit = currentUnits[matchIndex];
    if (currentUnit.kind === "node" && nextUnit.kind === "node") {
      diffNode(currentUnit.node, nextUnit.node, context);
      committed[i] = currentUnit;
      continue;
    }
    invariant(currentUnit.kind !== "node" && nextUnit.kind !== "node", "Expected boundaries");
    let replacement = getCommentMarkerRangeReplacement(currentUnit.start, nextUnit.start, currentNodes, nextNodes, currentUnit.startIndex, nextUnit.startIndex, context);
    if (replacement) {
      replaceCommentMarkerRange(replacement, parent, context);
      committed[i] = nextUnit;
      continue;
    }
    let cursor = diffNode(currentUnit.start, nextUnit.start, context);
    if (!cursor && currentUnit.kind === "frame" && nextUnit.kind === "frame") {
      diffNodes(collectNodesBetween(currentUnit.start, currentUnit.end), nextNodes.slice(nextUnit.startIndex + 1, nextUnit.endIndex), {
        ...context,
        regionParent: parent,
        regionTailRef: currentUnit.end
      });
    }
    committed[i] = currentUnit;
  }
  let anchor = regionTailRef;
  for (let i = committed.length - 1; i >= 0; i--) {
    let unit = committed[i];
    let first = getSiblingUnitFirstNode(unit);
    let ref = anchor?.parentNode === parent ? anchor : null;
    if (unit.kind === "node" && isPreservedDomElement(unit.node) && unit.node.parentNode === parent) {
      anchor = unit.node;
      continue;
    }
    placeSiblingUnitBefore(unit, parent, ref);
    if (first.parentNode === parent)
      anchor = first;
  }
  for (let i = 0; i < currentUnits.length; i++) {
    if (!used[i])
      removeSiblingUnit(currentUnits[i], parent, context);
  }
}
function parseSiblingUnits(nodes) {
  let units = [];
  for (let i = 0; i < nodes.length; i++) {
    let node = nodes[i];
    if (isVirtualRootStartMarker(node)) {
      let endIndex = findHydrationEndIndex(nodes, i);
      invariant(endIndex > i, "Hydration end marker not found");
      let end = nodes[endIndex];
      invariant(isVirtualRootEndMarker(end), "Expected hydration end marker");
      units.push({ kind: "hydration", start: node, end, startIndex: i, endIndex });
      i = endIndex;
      continue;
    }
    if (isFrameStartMarker(node)) {
      let endIndex = findFrameEndIndex(nodes, i);
      invariant(endIndex > i, "Frame end marker not found");
      let end = nodes[endIndex];
      invariant(isFrameEndMarker(end), "Expected frame end marker");
      units.push({ kind: "frame", start: node, end, startIndex: i, endIndex });
      i = endIndex;
      continue;
    }
    invariant(!isVirtualRootEndMarker(node), "Unexpected hydration end marker");
    invariant(!isFrameEndMarker(node), "Unexpected frame end marker");
    units.push({ kind: "node", node, startIndex: i, endIndex: i });
  }
  return units;
}
function getSiblingUnitKey(unit) {
  if (unit.kind !== "node" || !isElement(unit.node))
    return;
  return unit.node.getAttribute("data-rmx-key") ?? void 0;
}
function siblingUnitsComparable(current, next) {
  if (current.kind !== next.kind)
    return false;
  if (current.kind !== "node" || next.kind !== "node")
    return true;
  return nodeTypesComparable(current.node, next.node);
}
function shouldPreserveBoundaryUnit(current, next, context) {
  if (current.kind !== next.kind)
    return false;
  return current.kind === "frame" ? shouldPreserveFrameStartMarker(current.start, next.start, context) : shouldPreserveHydrationStartMarker(current.start, next.start, context);
}
function getSiblingUnitFirstNode(unit) {
  return unit.kind === "node" ? unit.node : unit.start;
}
function placeSiblingUnitBefore(unit, parent, ref) {
  if (unit.kind === "node") {
    if (unit.node.parentNode !== parent || unit.node.nextSibling !== ref) {
      parent.insertBefore(unit.node, ref);
    }
    return;
  }
  let nodes = collectNodeRange(unit.start, unit.end);
  if (unit.start.parentNode === parent && unit.end.nextSibling === ref)
    return;
  let fragment = unit.start.ownerDocument.createDocumentFragment();
  for (let node of nodes)
    fragment.appendChild(node);
  parent.insertBefore(fragment, ref);
}
function removeSiblingUnit(unit, parent, context) {
  if (unit.kind === "node") {
    removeNode(unit.node, parent, context);
    return;
  }
  for (let node of collectNodeRange(unit.start, unit.end)) {
    removeNode(node, parent, context);
  }
}
function collectNodesBetween(start, end) {
  let nodes = [];
  let node = start.nextSibling;
  while (node && node !== end) {
    nodes.push(node);
    node = node.nextSibling;
  }
  return nodes;
}
function isPreservedDomElement(node) {
  return isElement(node) && node.hasAttribute(REMIX_PRESERVE_DOM_ATTRIBUTE);
}
function nodeTypesComparable(a, b) {
  if (isTextNode(a) && isTextNode(b))
    return true;
  if (isElement(a) && isElement(b))
    return a.tagName === b.tagName;
  if (isCommentNode2(a) && isCommentNode2(b))
    return markerKindsMatch(a, b);
  return false;
}
function getMarkerKind(node) {
  if (!isCommentNode2(node))
    return void 0;
  if (isFrameStartMarker(node))
    return "frame-start";
  if (isFrameEndMarker(node))
    return "frame-end";
  if (isVirtualRootStartMarker(node))
    return "virtual-root-start";
  if (isVirtualRootEndMarker(node))
    return "virtual-root-end";
  return void 0;
}
function markerKindsMatch(a, b) {
  return getMarkerKind(a) === getMarkerKind(b);
}
function isHydrationEndComment(node) {
  return isCommentNode2(node) && node.data.trim() === "/rmx:h";
}
function findHydrationEndMarker(start) {
  let node = start.nextSibling;
  let depth = 1;
  while (node) {
    if (isCommentNode2(node)) {
      if (isVirtualRootStartMarker(node))
        depth++;
      if (isVirtualRootEndMarker(node)) {
        depth--;
        if (depth === 0)
          return node;
      }
    }
    node = node.nextSibling;
  }
  throw new Error("Hydration end marker not found");
}
function findHydrationEndIndex(nodes, startIdx) {
  let depth = 1;
  for (let j = startIdx + 1; j < nodes.length; j++) {
    let node = nodes[j];
    if (isVirtualRootStartMarker(node))
      depth++;
    if (isHydrationEndComment(node)) {
      depth--;
      if (depth === 0)
        return j;
    }
  }
  return startIdx;
}
function findFrameEndMarker(start) {
  let node = start.nextSibling;
  let depth = 1;
  while (node) {
    if (isFrameStartMarker(node))
      depth++;
    if (isFrameEndMarker(node)) {
      depth--;
      if (depth === 0)
        return node;
    }
    node = node.nextSibling;
  }
  throw new Error("Frame end marker not found");
}
function findFrameEndIndex(nodes, startIdx) {
  let depth = 1;
  for (let j = startIdx + 1; j < nodes.length; j++) {
    let node = nodes[j];
    if (isFrameStartMarker(node))
      depth++;
    if (isFrameEndMarker(node)) {
      depth--;
      if (depth === 0)
        return j;
    }
  }
  return startIdx;
}
function isTextNode(node) {
  return node.nodeType === Node.TEXT_NODE;
}
function isElement(node) {
  return node.nodeType === Node.ELEMENT_NODE;
}
function isCommentNode2(node) {
  return node.nodeType === Node.COMMENT_NODE;
}
function isFrameStartMarker(node) {
  return node instanceof Comment && node.data.trim().startsWith("rmx:f:");
}
function isFrameEndMarker(node) {
  return node instanceof Comment && node.data.trim() === "/rmx:f";
}
function shouldPreserveFrameStartMarker(current, next, context) {
  if (!isFrameStartMarker(next))
    return false;
  let nextData = getFrameMarkerData(next, context);
  let currentFrame = context.frameInstances.get(current);
  return currentFrame !== void 0 && nextData !== void 0 && currentFrame.matchesIdentity(nextData.src, nextData.name);
}
function shouldPreserveHydrationStartMarker(current, next, context) {
  if (!isVirtualRootStartMarker(next))
    return false;
  let currentOwner = getClientEntryBoundaryOwner(current);
  let nextData = getHydrationMarkerData(next, context);
  return currentOwner !== void 0 && nextData !== void 0 && currentOwner.identity.moduleUrl === nextData.moduleUrl && currentOwner.identity.exportName === nextData.exportName;
}
function getCommentMarkerRangeReplacement(current, next, currentNodes, nextNodes, currentIndex, nextIndex, context) {
  if (isFrameStartMarker(current) && isFrameStartMarker(next) && !shouldPreserveFrameStartMarker(current, next, context)) {
    return {
      currentStart: current,
      nextStart: next,
      currentEndIndex: findFrameEndIndex(currentNodes, currentIndex),
      nextEndIndex: findFrameEndIndex(nextNodes, nextIndex)
    };
  }
  if (isVirtualRootStartMarker(current) && isVirtualRootStartMarker(next) && !shouldPreserveHydrationStartMarker(current, next, context)) {
    return {
      currentStart: current,
      nextStart: next,
      currentEndIndex: findHydrationEndIndex(currentNodes, currentIndex),
      nextEndIndex: findHydrationEndIndex(nextNodes, nextIndex)
    };
  }
}
function getHydrationMarkerData(marker, context) {
  let id = getHydrationId(marker);
  return context.data.h?.[id];
}
function getHydrationId(marker) {
  let trimmed = marker.data.trim();
  invariant(trimmed.startsWith("rmx:h:"), "Invalid hydration start marker");
  return trimmed.slice("rmx:h:".length);
}
function getFrameMarkerData(marker, context) {
  let id = getFrameId(marker);
  return context.data.f?.[id];
}
function getFrameId(marker) {
  let trimmed = marker.data.trim();
  invariant(trimmed.startsWith("rmx:f:"), "Invalid frame start marker");
  return trimmed.slice("rmx:f:".length);
}
function replaceCommentMarkerRange(replacement, parent, context) {
  let currentEnd = findCommentMarkerRangeEnd(replacement.currentStart);
  let nextEnd = findCommentMarkerRangeEnd(replacement.nextStart);
  let nextNodes = collectNodeRange(replacement.nextStart, nextEnd);
  let currentNodes = collectNodeRange(replacement.currentStart, currentEnd);
  for (let node of nextNodes) {
    parent.insertBefore(node, replacement.currentStart);
  }
  for (let node of currentNodes) {
    removeNode(node, parent, context);
  }
}
function findCommentMarkerRangeEnd(start) {
  if (isFrameStartMarker(start))
    return findFrameEndMarker(start);
  if (isVirtualRootStartMarker(start))
    return findHydrationEndMarker(start);
  throw new Error("Comment marker range start not found");
}
function collectNodeRange(start, end) {
  let nodes = [];
  let node = start;
  while (node) {
    nodes.push(node);
    if (node === end)
      break;
    node = node.nextSibling;
  }
  return nodes;
}
function collectFrameContentFragment(doc, start, end) {
  let fragment = doc.createDocumentFragment();
  let node = start.nextSibling;
  while (node && node !== end) {
    let next = node.nextSibling;
    fragment.appendChild(node);
    node = next;
  }
  return fragment;
}
function removeNode(node, parent, context) {
  disposeRemovedVirtualRoots(node);
  disposeRemovedSubFrames(node, context);
  if (node.parentNode === parent) {
    parent.removeChild(node);
  }
}
function disposeRemovedVirtualRoots(node) {
  let stack = [node];
  while (stack.length > 0) {
    let next = stack.pop();
    if (!next)
      continue;
    if (isVirtualRootStartMarker(next) && disposeClientEntryBoundary(next)) {
      continue;
    }
    for (let child of Array.from(next.childNodes)) {
      stack.push(child);
    }
  }
}
function disposeRemovedSubFrames(node, context) {
  let stack = [node];
  while (stack.length > 0) {
    let next = stack.pop();
    if (!next)
      continue;
    if (isFrameStartMarker(next)) {
      disposeFrameStartMarker(next, context);
    }
    for (let child of Array.from(next.childNodes)) {
      stack.push(child);
    }
  }
}
function disposeFrameStartMarker(marker, context) {
  let subFrame = context.frameInstances.get(marker);
  if (subFrame) {
    subFrame.dispose();
    context.frameInstances.delete(marker);
  }
}
function isVirtualRootStartMarker(node) {
  return isCommentNode2(node) && node.data.trim().startsWith("rmx:h:");
}
function isVirtualRootEndMarker(node) {
  return isCommentNode2(node) && node.data.trim() === "/rmx:h";
}

// node_modules/@remix-run/component/dist/runtime/stream-protocol.js
var FLUSH_MARKER_PATTERN = /<!--\s*rmx:flush\s+(document|fragment)\s*-->/g;
function findFlushMarker(html, startIndex) {
  FLUSH_MARKER_PATTERN.lastIndex = startIndex;
  let match = FLUSH_MARKER_PATTERN.exec(html);
  if (!match)
    return void 0;
  return {
    index: match.index,
    endIndex: FLUSH_MARKER_PATTERN.lastIndex,
    kind: match[1]
  };
}

// node_modules/@remix-run/component/dist/runtime/module-preloader.js
var SERVER_MODULE_PRELOAD_SELECTOR = 'link[data-rmx-module-preload][rel~="modulepreload" i][href]';
var modulePreloaders = /* @__PURE__ */ new WeakMap();
function getDocumentModulePreloader(doc) {
  let preloader = modulePreloaders.get(doc);
  if (!preloader) {
    preloader = createModulePreloader(doc);
    modulePreloaders.set(doc, preloader);
  }
  return preloader;
}
function createModulePreloader(doc) {
  let requestedUrls = /* @__PURE__ */ new Set();
  let activeLinks = /* @__PURE__ */ new WeakSet();
  let activeLinkCount = 0;
  function activateLink(link) {
    activeLinks.add(link);
    activeLinkCount++;
  }
  function deactivateLink(link) {
    if (activeLinks.delete(link))
      activeLinkCount--;
  }
  function preload(href) {
    let link = doc.createElement("link");
    link.rel = "modulepreload";
    link.href = href;
    link.setAttribute("data-rmx-module-preload", "");
    let url = link.href;
    if (requestedUrls.has(url))
      return;
    requestedUrls.add(url);
    activateLink(link);
    link.addEventListener("load", () => {
      deactivateLink(link);
      link.remove();
    }, { once: true });
    link.addEventListener("error", () => {
      deactivateLink(link);
      link.remove();
      requestedUrls.delete(url);
    }, { once: true });
    doc.head.append(link);
  }
  return {
    adoptInitialPreloadLinks(source) {
      for (let initialLink of source.querySelectorAll(SERVER_MODULE_PRELOAD_SELECTOR)) {
        let settle = function(succeeded) {
          if (settled)
            return;
          settled = true;
          deactivateLink(initialLink);
          deactivateLink(observerLink);
          initialLink.remove();
          observerLink.remove();
          if (!succeeded)
            requestedUrls.delete(url);
        };
        if (activeLinks.has(initialLink))
          continue;
        let observerLink = doc.createElement("link");
        observerLink.rel = "modulepreload";
        observerLink.href = initialLink.href;
        observerLink.setAttribute("data-rmx-module-preload", "");
        let url = initialLink.href;
        requestedUrls.add(url);
        activateLink(initialLink);
        activateLink(observerLink);
        let settled = false;
        observerLink.addEventListener("load", () => settle(true), { once: true });
        observerLink.addEventListener("error", () => settle(false), { once: true });
        doc.head.append(observerLink);
      }
    },
    async consumePreloadLinks(source, process) {
      let hrefs = [];
      for (let link of source.querySelectorAll(SERVER_MODULE_PRELOAD_SELECTOR)) {
        let href = link.getAttribute("href");
        link.remove();
        if (href)
          hrefs.push(href);
      }
      let processedHrefs = process ? await process(hrefs) : hrefs;
      for (let href of processedHrefs)
        preload(href);
    },
    hasActivePreloads() {
      return activeLinkCount > 0;
    },
    isActivePreload(node) {
      return node instanceof HTMLLinkElement && activeLinks.has(node);
    }
  };
}

// node_modules/@remix-run/component/dist/runtime/import-map-manager.js
var MANAGED_IMPORT_MAP_SELECTOR = 'script[data-rmx-import-map][type="importmap"]';
var IMPORT_MAP_SELECTOR = 'script[type="importmap"]';
var importMapManagers = /* @__PURE__ */ new WeakMap();
var ImportMapConflictError = class extends Error {
};
function getDocumentImportMapManager(doc) {
  let manager = importMapManagers.get(doc);
  if (!manager) {
    manager = createImportMapManager(doc);
    importMapManagers.set(doc, manager);
  }
  return manager;
}
function createImportMapManager(doc) {
  let nonce = doc.head.querySelector(MANAGED_IMPORT_MAP_SELECTOR)?.nonce;
  let installedImportMap = createInstalledImportMap();
  let processedScripts = /* @__PURE__ */ new WeakSet();
  let conflicted = false;
  function processImportMap(script) {
    if (processedScripts.has(script))
      return;
    processedScripts.add(script);
    let importMap = parseImportMap(script.textContent ?? "");
    if (importMap)
      mergeInstalledImportMap(installedImportMap, importMap, script.baseURI);
  }
  function processImportMaps() {
    for (let script of doc.querySelectorAll(IMPORT_MAP_SELECTOR)) {
      processImportMap(script);
    }
  }
  function processMutations(mutations) {
    for (let mutation of mutations) {
      if (mutation.type !== "childList")
        continue;
      for (let node of mutation.addedNodes) {
        if (node instanceof HTMLScriptElement && node.matches(IMPORT_MAP_SELECTOR)) {
          processImportMap(node);
        }
      }
    }
  }
  let observer = new MutationObserver(processMutations);
  observer.observe(doc, { childList: true });
  observer.observe(doc.head, { childList: true });
  processImportMaps();
  return {
    consumeImportMaps(source) {
      if (conflicted)
        return "blocked";
      processMutations(observer.takeRecords());
      processImportMaps();
      let scripts = Array.from(source.querySelectorAll(MANAGED_IMPORT_MAP_SELECTOR));
      if (scripts.length === 0)
        return "ready";
      let pendingImportMap = {
        imports: new Map(installedImportMap.imports),
        scopes: new Map(Array.from(installedImportMap.scopes, ([scope, imports]) => [scope, new Map(imports)])),
        integrity: new Map(installedImportMap.integrity)
      };
      let deltas = [];
      let baseUrl = doc.baseURI;
      try {
        for (let script of scripts) {
          let importMap = parseImportMap(script.textContent ?? "");
          if (!importMap)
            continue;
          let delta = getImportMapDelta(pendingImportMap, importMap, baseUrl);
          if (delta) {
            deltas.push(delta);
            mergeInstalledImportMap(pendingImportMap, delta, baseUrl);
          }
        }
      } catch (error) {
        if (!(error instanceof ImportMapConflictError))
          throw error;
        console.warn(error.message);
        conflicted = true;
        return "conflict";
      }
      for (let delta of deltas) {
        let installedScript = appendImportMapScript(doc, delta, nonce);
        processedScripts.add(installedScript);
      }
      installedImportMap = pendingImportMap;
      for (let script of scripts)
        script.remove();
      return "ready";
    },
    disconnect() {
      observer.disconnect();
    },
    shouldPreserveHeadNode(node) {
      return node.isConnected && node instanceof HTMLScriptElement && node.matches(MANAGED_IMPORT_MAP_SELECTOR);
    }
  };
}
function createInstalledImportMap() {
  return {
    imports: /* @__PURE__ */ new Map(),
    scopes: /* @__PURE__ */ new Map(),
    integrity: /* @__PURE__ */ new Map()
  };
}
function getImportMapDelta(installedImportMap, importMap, baseUrl) {
  let imports = getImportMapImportsDelta(installedImportMap.imports, importMap.imports, baseUrl);
  let scopes = getImportMapScopesDelta(installedImportMap, importMap.scopes, baseUrl);
  let integrity = getImportMapIntegrityDelta(installedImportMap.integrity, importMap.integrity, baseUrl);
  if (!imports && !scopes && !integrity)
    return void 0;
  return {
    ...imports ? { imports } : null,
    ...scopes ? { scopes } : null,
    ...integrity ? { integrity } : null
  };
}
function getImportMapImportsDelta(installedImports, imports, baseUrl, scope) {
  if (!imports)
    return void 0;
  let delta = {};
  for (let [specifier, href] of Object.entries(imports)) {
    let normalizedSpecifier = normalizeImportMapSpecifier(specifier, baseUrl);
    if (normalizedSpecifier === null)
      continue;
    let normalizedHref = normalizeImportMapAddress(href, baseUrl);
    let installedEntry = installedImports.get(normalizedSpecifier);
    if (installedEntry?.normalizedHref === normalizedHref)
      continue;
    if (installedEntry) {
      let scopeDescription = scope ? ` in scope "${scope}"` : "";
      throw new ImportMapConflictError(`[remix] Reloading page after import map conflict for "${specifier}"${scopeDescription}: ${formatImportMapAddress(installedEntry.href)} is already installed, but the new map points to ${formatImportMapAddress(href)}`);
    }
    delta[specifier] = href;
  }
  return Object.keys(delta).length > 0 ? delta : void 0;
}
function getImportMapScopesDelta(installedImportMap, scopes, baseUrl) {
  if (!scopes)
    return void 0;
  let delta = {};
  for (let [scope, imports] of Object.entries(scopes)) {
    let normalizedScope = normalizeImportMapUrl(scope, baseUrl);
    if (normalizedScope === null)
      continue;
    let installedScopeImports = installedImportMap.scopes.get(normalizedScope) ?? /* @__PURE__ */ new Map();
    let importsDelta = getImportMapImportsDelta(installedScopeImports, imports, baseUrl, scope);
    if (importsDelta)
      delta[scope] = importsDelta;
  }
  return Object.keys(delta).length > 0 ? delta : void 0;
}
function getImportMapIntegrityDelta(installedIntegrity, integrity, baseUrl) {
  if (!integrity)
    return void 0;
  let delta = {};
  for (let [url, metadata] of Object.entries(integrity)) {
    let normalizedUrl = normalizeImportMapUrl(url, baseUrl);
    if (normalizedUrl === null)
      continue;
    let installedMetadata = installedIntegrity.get(normalizedUrl);
    if (installedMetadata === metadata)
      continue;
    if (installedMetadata !== void 0) {
      throw new ImportMapConflictError(`[remix] Reloading page after import map integrity conflict for "${url}": "${installedMetadata}" is already installed, but the new map points to "${metadata}"`);
    }
    delta[url] = metadata;
  }
  return Object.keys(delta).length > 0 ? delta : void 0;
}
function mergeInstalledImportMap(installedImportMap, importMap, baseUrl) {
  mergeInstalledImports(installedImportMap.imports, importMap.imports, baseUrl);
  if (importMap.scopes) {
    for (let [scope, imports] of Object.entries(importMap.scopes)) {
      let normalizedScope = normalizeImportMapUrl(scope, baseUrl);
      if (normalizedScope === null)
        continue;
      let installedScopeImports = installedImportMap.scopes.get(normalizedScope);
      if (!installedScopeImports) {
        installedScopeImports = /* @__PURE__ */ new Map();
        installedImportMap.scopes.set(normalizedScope, installedScopeImports);
      }
      mergeInstalledImports(installedScopeImports, imports, baseUrl);
    }
  }
  if (importMap.integrity) {
    for (let [url, metadata] of Object.entries(importMap.integrity)) {
      let normalizedUrl = normalizeImportMapUrl(url, baseUrl);
      if (normalizedUrl === null || installedImportMap.integrity.has(normalizedUrl))
        continue;
      installedImportMap.integrity.set(normalizedUrl, metadata);
    }
  }
}
function mergeInstalledImports(installed, imports, baseUrl) {
  for (let [specifier, href] of Object.entries(imports ?? {})) {
    let normalizedSpecifier = normalizeImportMapSpecifier(specifier, baseUrl);
    if (normalizedSpecifier === null || installed.has(normalizedSpecifier))
      continue;
    installed.set(normalizedSpecifier, {
      href,
      normalizedHref: normalizeImportMapAddress(href, baseUrl)
    });
  }
}
function appendImportMapScript(doc, importMap, nonce) {
  let script = doc.createElement("script");
  script.setAttribute("data-rmx-import-map", "");
  script.type = "importmap";
  if (nonce)
    script.nonce = nonce;
  script.textContent = JSON.stringify(importMap);
  doc.head.appendChild(script);
  return script;
}
function parseImportMap(json) {
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object")
    return null;
  let importMap = {};
  if ("imports" in parsed) {
    let imports = parsed.imports;
    if (!isImportMapImports(imports))
      return null;
    importMap.imports = imports;
  }
  if ("scopes" in parsed) {
    let scopes = parsed.scopes;
    if (!isScopedImportMapRecord(scopes))
      return null;
    importMap.scopes = scopes;
  }
  if ("integrity" in parsed) {
    let integrity = parsed.integrity;
    if (!isImportMapIntegrity(integrity))
      return null;
    importMap.integrity = integrity;
  }
  return importMap;
}
function isImportMapImports(value) {
  if (!value || typeof value !== "object")
    return false;
  return Object.values(value).every((entry) => entry === null || typeof entry === "string");
}
function isScopedImportMapRecord(value) {
  if (!value || typeof value !== "object")
    return false;
  return Object.values(value).every(isImportMapImports);
}
function isImportMapIntegrity(value) {
  if (!value || typeof value !== "object")
    return false;
  return Object.values(value).every((entry) => typeof entry === "string");
}
function normalizeImportMapSpecifier(specifier, baseUrl) {
  if (specifier.startsWith("/") || specifier.startsWith("./") || specifier.startsWith("../") || URL.canParse(specifier)) {
    return normalizeImportMapUrl(specifier, baseUrl);
  }
  return specifier;
}
function normalizeImportMapAddress(address, baseUrl) {
  if (address === null)
    return null;
  return normalizeImportMapUrl(address, baseUrl);
}
function normalizeImportMapUrl(value, baseUrl) {
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return null;
  }
}
function formatImportMapAddress(address) {
  return address === null ? "null" : `"${address}"`;
}

// node_modules/@remix-run/component/dist/runtime/document-reload.js
var documentReloadInfo = "remix-document-reload";
function isDocumentReload(info) {
  return info === documentReloadInfo;
}
function reloadDocument(doc, href = doc.location.href) {
  let navigation = doc.defaultView?.navigation;
  if (navigation) {
    navigation.navigate(href, { history: "replace", info: documentReloadInfo });
  } else {
    doc.location.replace(href);
  }
}
function reloadCurrentDocument(doc) {
  let navigation = doc.defaultView?.navigation;
  if (navigation && typeof navigation.reload === "function") {
    navigation.reload({ info: documentReloadInfo });
  } else {
    doc.location.reload();
  }
}

// node_modules/@remix-run/component/dist/runtime/frame.js
var NamedFrameRegistry = class {
  #framesByName = /* @__PURE__ */ new Map();
  register(name, frame) {
    let frames = this.#framesByName.get(name);
    if (frames) {
      frames.push(frame);
    } else {
      this.#framesByName.set(name, [frame]);
    }
  }
  get(name) {
    return this.#framesByName.get(name)?.at(-1);
  }
  unregister(name, frame) {
    let frames = this.#framesByName.get(name);
    if (!frames)
      return;
    let index = frames.lastIndexOf(frame);
    if (index === -1)
      return;
    frames.splice(index, 1);
    if (frames.length === 0) {
      this.#framesByName.delete(name);
    }
  }
};
var bufferedFrameTemplates = /* @__PURE__ */ new Map();
var frameTemplateListeners = /* @__PURE__ */ new Map();
var pendingClientEntryHydrations = /* @__PURE__ */ new WeakMap();
var frameClientEntryParents = /* @__PURE__ */ new WeakMap();
var DOCTYPE_PATTERN = /<!doctype(?:\s[^>]*)?>/gi;
function createLinkedAbortController(first, second) {
  let controller = new AbortController();
  let signals = second ? [first, second] : [first];
  let abort = () => controller.abort();
  for (let signal of signals) {
    if (signal.aborted) {
      controller.abort();
      break;
    }
    signal.addEventListener("abort", abort, { once: true });
  }
  return {
    controller,
    disconnect() {
      for (let signal of signals) {
        signal.removeEventListener("abort", abort);
      }
    }
  };
}
function stripDoctypeMarkup(html) {
  return html.replace(DOCTYPE_PATTERN, "");
}
var FULL_DOCUMENT_PATTERN = /^\s*(?:<!doctype\b|<html\b)/i;
function inferFlushKind(html) {
  return FULL_DOCUMENT_PATTERN.test(html) ? "document" : "fragment";
}
var FRAME_RUNTIME = /* @__PURE__ */ Symbol("FrameRuntime");
function isFrameRuntime(value) {
  return isRecord(value) && Reflect.get(value, FRAME_RUNTIME) === true;
}
function reloadFrameForNavigation(frame, options) {
  let runtime = frame.$runtime;
  invariant(isFrameRuntime(runtime), "Expected a frame runtime");
  let reload = runtime.reloadForNavigation;
  invariant(reload, "Expected frame runtime to support navigation reloads");
  return reload(options);
}
function createFrame(root, init) {
  let container = createContainer(root);
  let contentRoot;
  let reloadController;
  let ownsStyleManager = !init.styleManager;
  let reloadAbortUnsubscribe;
  let reloadKind;
  let styleManager = init.styleManager ?? createStyleManager();
  let modulePreloader = getDocumentModulePreloader(container.doc);
  let importMapManager = getDocumentImportMapManager(container.doc);
  let currentMarker = init.marker;
  let displayedContentStatus = init.marker?.status ?? "resolved";
  let pendingTemplateMarkerId;
  let pendingTemplateObserver;
  let pendingTemplateUnsubscribe;
  let inheritedReloadPending = false;
  let inheritedReloadAbortUnsubscribe;
  let disposed = false;
  let lifecycleController = new AbortController();
  async function consumeClientEntryResources(source, documentHref) {
    let importMapStatus = importMapManager.consumeImportMaps(source);
    if (importMapStatus !== "ready") {
      lifecycleController.abort();
      if (importMapStatus === "conflict")
        reloadDocument(container.doc, documentHref);
      return false;
    }
    await modulePreloader.consumePreloadLinks(source, init.processClientEntryPreloads);
    return true;
  }
  let initialClientEntryResources;
  function shouldPreserveManagedHeadNode(node) {
    return importMapManager.shouldPreserveHeadNode(node) || modulePreloader.hasActivePreloads() && modulePreloader.isActivePreload(node);
  }
  if (isDocumentNode(container.root)) {
    modulePreloader.adoptInitialPreloadLinks(container.root);
  } else {
    initialClientEntryResources = consumeClientEntryResources(container.root);
  }
  mergeRmxDataFromDocument(init.data, container.doc);
  let runtime = createFrameRuntime({
    ...init,
    styleManager,
    reloadForNavigation: startReloadTransition
  });
  let frame = createFrameHandle({
    src: init.src,
    $runtime: runtime,
    reload: async () => (await reload()).signal,
    replace: async (content) => {
      await render(content);
    }
  });
  runtime.topFrame = runtime.topFrame ?? init.topFrame ?? frame;
  let frameName = init.marker?.name ?? init.name;
  if (frameName) {
    init.namedFrames.register(frameName, frame);
  }
  let context = {
    topFrame: runtime.topFrame,
    getContext: (type) => runtime.getContext?.(type),
    errorTarget: init.errorTarget,
    loadModule: init.loadModule,
    resolveFrame: init.resolveFrame,
    pendingClientEntries: init.pendingClientEntries,
    scheduler: init.scheduler,
    frame,
    styleManager,
    data: init.data,
    moduleCache: init.moduleCache,
    moduleLoads: init.moduleLoads,
    frameInstances: init.frameInstances,
    namedFrames: init.namedFrames,
    processClientEntryPreloads: init.processClientEntryPreloads,
    lifecycleSignal: lifecycleController.signal,
    regionTailRef: container.regionTailRef,
    regionParent: container.regionParent
  };
  async function render(content, options) {
    if (disposed || lifecycleController.signal.aborted || options?.signal?.aborted)
      return;
    let ownsData = options?.data === void 0;
    let renderOptions = {
      ...options,
      data: options?.data ?? {}
    };
    try {
      await renderContent(content, renderOptions);
    } finally {
      if (ownsData)
        clearRmxData(renderOptions.data);
    }
  }
  async function renderContent(content, options) {
    if (isRenderAborted(options.signal))
      return;
    if (content instanceof ReadableStream) {
      let linkedAbort = createLinkedAbortController(lifecycleController.signal, options.signal);
      try {
        await renderFrameStream(content, container.doc, async (html, flushKind) => {
          if (isRenderAborted(options.signal))
            return;
          await render(html, { ...options, flushKind });
        }, linkedAbort.controller.signal);
      } finally {
        linkedAbort.disconnect();
      }
      return;
    }
    if (isRemixNodeFrameContent(content)) {
      if (!contentRoot) {
        let currentNodes = getContentNodes();
        removeVirtualRoots(currentNodes);
        disposeSubFrames(currentNodes, context);
        clearFrameContent();
        contentRoot = createFrameContentRoot();
      }
      if (isRenderAborted(options.signal))
        return;
      let previousServerFrameReload = runtime.serverFrameReload;
      if (options.signal) {
        runtime.serverFrameReload = {
          signal: options.signal,
          reconciliationTracker: options.reconciliationTracker,
          blockingFrameTracker: options.blockingFrameTracker
        };
      }
      try {
        contentRoot.render(content);
        await new Promise((resolve) => context.scheduler.enqueueCommitPhase([resolve]));
        options.onCommit?.();
      } finally {
        runtime.serverFrameReload = previousServerFrameReload;
      }
      if (isRenderAborted(options.signal))
        return;
      displayedContentStatus = options.contentStatus ?? "resolved";
      return;
    }
    if (contentRoot) {
      contentRoot.dispose();
      contentRoot = void 0;
    }
    if (typeof content === "string") {
      let flushed = await consumeFlushBatches(content, async (html, flushKind) => {
        await render(html, { ...options, flushKind });
      });
      if (flushed.applied) {
        if (flushed.remainder !== "") {
          await render(flushed.remainder, { ...options, flushKind: "fragment" });
        }
        return;
      }
    }
    let rawHtml = typeof content === "string" ? content : void 0;
    let htmlContent = rawHtml === void 0 ? void 0 : stripDoctypeMarkup(rawHtml);
    let isFullDocumentReload = container.root instanceof Document && rawHtml !== void 0 && (options.flushKind ?? inferFlushKind(rawHtml)) === "document";
    if (isFullDocumentReload && htmlContent !== void 0) {
      let parsed = new DOMParser().parseFromString(htmlContent, "text/html");
      if (!await consumeClientEntryResources(parsed, options.documentHref))
        return;
      if (isRenderAborted(options.signal))
        return;
      let responseData2 = options.data;
      mergeRmxDataFromDocument(responseData2, parsed);
      let responseContext2 = {
        ...context,
        data: responseData2,
        reconciliationTracker: options.reconciliationTracker,
        blockingFrameTracker: options.blockingFrameTracker
      };
      context.styleManager.adoptServerStyles(collectFrameServerStyleTags(createElementContainer(parsed)));
      diffElementAttributes(container.doc.documentElement, parsed.documentElement);
      diffNodes([container.doc.head], [parsed.head], {
        ...responseContext2,
        regionParent: container.doc.documentElement,
        regionTailRef: null,
        signal: options.signal,
        shouldPreserveHeadNode: shouldPreserveManagedHeadNode
      });
      diffNodes([container.doc.body], [parsed.body], {
        ...responseContext2,
        regionParent: container.doc.documentElement,
        regionTailRef: null,
        signal: options.signal
      });
      let bodyContainer = createElementContainer(container.doc.body);
      if (isRenderAborted(options.signal))
        return;
      let subFramesReady2 = hydrateContainer(bodyContainer, responseContext2, options);
      options.onCommit?.();
      await subFramesReady2;
      if (isRenderAborted(options.signal))
        return;
      displayedContentStatus = options.contentStatus ?? "resolved";
      return;
    }
    let fragment = htmlContent !== void 0 ? createFragmentFromString(container.doc, htmlContent) : content;
    if (!await consumeClientEntryResources(fragment, options.documentHref))
      return;
    if (isRenderAborted(options.signal))
      return;
    context.styleManager.adoptServerStyles(collectFrameServerStyleTags(createElementContainer(fragment)));
    removeEmptyHeads(fragment);
    let responseData = options.data;
    mergeRmxDataFromFragment(responseData, fragment);
    let responseContext = {
      ...context,
      data: responseData,
      reconciliationTracker: options.reconciliationTracker,
      blockingFrameTracker: options.blockingFrameTracker
    };
    let nextContainer = createContainer(fragment);
    if (isRenderAborted(options.signal))
      return;
    diffNodes(container.childNodes, Array.from(nextContainer.childNodes), {
      ...responseContext,
      regionTailRef: container.regionTailRef,
      regionParent: container.regionParent,
      signal: options.signal
    });
    let subFramesReady = hydrateContainer(container, responseContext, options);
    options.onCommit?.();
    await subFramesReady;
    if (isRenderAborted(options.signal))
      return;
    displayedContentStatus = options.contentStatus ?? "resolved";
  }
  function isRenderAborted(signal) {
    return disposed || lifecycleController.signal.aborted || signal?.aborted === true;
  }
  function createFrameContentRoot() {
    let virtualRoot;
    if (container.root instanceof Document) {
      virtualRoot = createRoot(container.doc.body, {
        scheduler: context.scheduler,
        frame,
        getContext: context.getContext,
        styleManager: context.styleManager
      });
    } else {
      invariant(Array.isArray(root), "Expected comment-bounded frame root");
      virtualRoot = createRangeRoot(root, {
        scheduler: context.scheduler,
        frame,
        getContext: context.getContext,
        styleManager: context.styleManager
      });
    }
    virtualRoot.addEventListener("error", (event) => {
      if (context.errorTarget === virtualRoot)
        return;
      context.errorTarget.dispatchEvent(createComponentErrorEvent(getComponentError(event)));
    });
    return virtualRoot;
  }
  function getContentNodes() {
    return container.root instanceof Document ? Array.from(container.doc.body.childNodes) : container.childNodes;
  }
  function clearFrameContent() {
    for (let node of getContentNodes()) {
      node.parentNode?.removeChild(node);
    }
  }
  async function hydrateInitial() {
    let reconciliationTracker = createReconciliationTracker();
    if (await initialClientEntryResources === false)
      return;
    if (disposed || context.lifecycleSignal.aborted)
      return;
    context.styleManager.adoptServerStyles(collectFrameServerStyleTags(container));
    let subFramesReady = hydrateContainer(container, context, { reconciliationTracker });
    try {
      await subFramesReady;
      if (disposed || context.lifecycleSignal.aborted)
        return;
      if (currentMarker?.status === "pending") {
        await watchPendingFrameTemplate(currentMarker, reconciliationTracker);
      }
      reconciliationTracker.finalize();
      await reconciliationTracker.ready();
    } finally {
      clearRmxData(context.data);
    }
  }
  function dispose() {
    if (disposed)
      return;
    disposed = true;
    lifecycleController.abort();
    clearRmxData(context.data);
    reloadController?.abort();
    reloadController = void 0;
    reloadAbortUnsubscribe?.();
    reloadAbortUnsubscribe = void 0;
    reloadKind = void 0;
    contentRoot?.dispose();
    contentRoot = void 0;
    clearPendingFrameTemplateWatch();
    removeVirtualRoots(container.childNodes);
    disposeSubFrames(container.childNodes, context);
    if (ownsStyleManager) {
      context.styleManager.dispose();
    }
    if (frameName) {
      init.namedFrames.unregister(frameName, frame);
    }
  }
  let readyPromise = hydrateInitial();
  return {
    render,
    ready: () => readyPromise,
    flush: () => context.scheduler.dequeue(),
    clearPendingTemplateWatch: clearPendingFrameTemplateWatch,
    isDisplayingResolvedContent: () => displayedContentStatus === "resolved",
    beginClientFrameReloadForAncestorReload,
    cancelReload,
    startInheritedReload,
    updateMarker,
    renderMarkerContent,
    matchesIdentity: (src, name) => !disposed && frame.src === src && frameName === name,
    dispose,
    handle: frame
  };
  async function updateMarker(marker, options) {
    if (disposed || context.lifecycleSignal.aborted || options?.signal?.aborted)
      return;
    let previousMarker = currentMarker;
    let isInheritedReload = previousMarker !== void 0 && previousMarker.id !== marker.id;
    currentMarker = marker;
    if (isInheritedReload) {
      startInheritedReload(options?.signal);
    }
    if (marker.status === "pending") {
      await watchPendingFrameTemplate(marker, options?.reconciliationTracker, options?.signal, isInheritedReload ? () => {
        completeInheritedReload();
      } : void 0);
    } else {
      clearPendingFrameTemplateWatch();
      if (isInheritedReload && !options?.signal?.aborted) {
        completeInheritedReload();
      }
    }
  }
  async function renderMarkerContent(marker, content, options) {
    if (disposed || context.lifecycleSignal.aborted || options?.signal?.aborted)
      return;
    let previousMarker = currentMarker;
    let isInheritedReload = previousMarker !== void 0 && previousMarker.id !== marker.id;
    currentMarker = marker;
    if (isInheritedReload) {
      startInheritedReload(options?.signal);
    }
    clearPendingFrameTemplateWatch();
    await render(content, { ...options, contentStatus: "resolved" });
    if (isInheritedReload && !disposed && !context.lifecycleSignal.aborted && !options?.signal?.aborted) {
      completeInheritedReload();
    }
  }
  async function reload(options) {
    let transition = startReloadTransition(options);
    void transition.committed.catch(() => {
    });
    return await transition.finished;
  }
  function startReloadTransition(options) {
    let controller = startReload(options?.signal);
    let committed = Promise.withResolvers();
    let commitStarted = false;
    let finished = resolveAndRenderReload(controller, options, (ready) => {
      if (commitStarted)
        return;
      commitStarted = true;
      void ready.then(committed.resolve, committed.reject);
    });
    void finished.then(() => committed.resolve(), committed.reject);
    return { signal: controller.signal, committed: committed.promise, finished };
  }
  function startReload(signal) {
    let controller = replaceReloadController(signal);
    reloadKind = "direct";
    frame.dispatchEvent(new Event("reloadStart"));
    startSubFrameInheritedReloads(getContentNodes(), controller.signal);
    return controller;
  }
  function beginClientFrameReloadForAncestorReload(signal) {
    let inheritedReloadStarted = reuseInheritedReloadStart();
    let continuingAncestorReload = reloadKind === "ancestor";
    let controller = replaceReloadController(signal);
    reloadKind = "ancestor";
    if (!inheritedReloadStarted && !continuingAncestorReload) {
      frame.dispatchEvent(new Event("reloadStart"));
      startSubFrameInheritedReloads(getContentNodes(), controller.signal);
    }
    return {
      controller,
      complete: () => completeReload(controller)
    };
  }
  function cancelReload() {
    let controller = reloadController;
    if (!controller)
      return;
    controller.abort();
    completeReload(controller);
  }
  function replaceReloadController(signal) {
    reloadController?.abort();
    reloadAbortUnsubscribe?.();
    reloadAbortUnsubscribe = void 0;
    let controller = new AbortController();
    reloadController = controller;
    if (signal) {
      if (signal.aborted) {
        controller.abort();
      } else {
        let abort = () => controller.abort();
        signal.addEventListener("abort", abort, { once: true });
        reloadAbortUnsubscribe = () => signal.removeEventListener("abort", abort);
      }
    }
    return controller;
  }
  async function resolveAndRenderReload(controller, options, resolveCommit) {
    try {
      let resolution = await init.resolveFrame(frame.src, {
        ...options,
        signal: controller.signal,
        target: frameName
      });
      if (reloadController !== controller || controller.signal.aborted) {
        return { signal: controller.signal };
      }
      let { content, redirectedTo } = await unwrapFrameResolution(resolution);
      if (reloadController !== controller || controller.signal.aborted) {
        return { signal: controller.signal };
      }
      let reconciliationTracker = createReconciliationTracker();
      let blockingFrameTracker = createReconciliationTracker();
      let commitStarted = false;
      await render(content, {
        documentHref: isDocumentNode(container.root) ? redirectedTo ?? frame.src : void 0,
        signal: controller.signal,
        reconciliationTracker,
        blockingFrameTracker,
        onCommit() {
          if (commitStarted)
            return;
          commitStarted = true;
          blockingFrameTracker.finalize();
          resolveCommit?.(blockingFrameTracker.ready());
        }
      });
      reconciliationTracker.finalize();
      await reconciliationTracker.ready();
      return {
        signal: controller.signal,
        redirectedTo: reloadController === controller && !controller.signal.aborted ? redirectedTo : void 0
      };
    } catch (error) {
      if (reloadController !== controller || controller.signal.aborted) {
        return { signal: controller.signal };
      }
      init.errorTarget.dispatchEvent(createComponentErrorEvent(error));
      throw error;
    } finally {
      completeReload(controller);
    }
  }
  function completeReload(controller) {
    if (reloadController !== controller || reloadKind === void 0)
      return;
    reloadAbortUnsubscribe?.();
    reloadAbortUnsubscribe = void 0;
    reloadKind = void 0;
    frame.dispatchEvent(new Event("reloadComplete"));
  }
  function startInheritedReload(signal) {
    if (signal?.aborted)
      return;
    if (!inheritedReloadPending) {
      inheritedReloadPending = true;
      frame.dispatchEvent(new Event("reloadStart"));
      startSubFrameInheritedReloads(getContentNodes(), signal);
    }
    inheritedReloadAbortUnsubscribe?.();
    inheritedReloadAbortUnsubscribe = void 0;
    if (signal) {
      let abort = () => completeInheritedReload();
      signal.addEventListener("abort", abort, { once: true });
      inheritedReloadAbortUnsubscribe = () => {
        signal.removeEventListener("abort", abort);
      };
    }
  }
  function reuseInheritedReloadStart() {
    if (!inheritedReloadPending)
      return false;
    inheritedReloadPending = false;
    inheritedReloadAbortUnsubscribe?.();
    inheritedReloadAbortUnsubscribe = void 0;
    return true;
  }
  function completeInheritedReload() {
    if (!inheritedReloadPending)
      return;
    inheritedReloadPending = false;
    inheritedReloadAbortUnsubscribe?.();
    inheritedReloadAbortUnsubscribe = void 0;
    frame.dispatchEvent(new Event("reloadComplete"));
  }
  function startSubFrameInheritedReloads(nodes, signal) {
    for (let i = 0; i < nodes.length; i++) {
      if (signal?.aborted)
        break;
      let node = nodes[i];
      if (isFrameStart(node)) {
        let end = findEndMarker(node, isFrameStart, isFrameEnd);
        context.frameInstances.get(node)?.startInheritedReload(signal);
        i = findMarkerRangeEndIndex(nodes, end, i);
        continue;
      }
      if (node.childNodes && node.childNodes.length > 0) {
        startSubFrameInheritedReloads(Array.from(node.childNodes), signal);
      }
    }
  }
  function clearPendingFrameTemplateWatch() {
    pendingTemplateUnsubscribe?.();
    pendingTemplateUnsubscribe = void 0;
    pendingTemplateObserver?.disconnect();
    pendingTemplateObserver = void 0;
    pendingTemplateMarkerId = void 0;
  }
  async function watchPendingFrameTemplate(marker, reconciliationTracker, signal, onResolved) {
    if (disposed || context.lifecycleSignal.aborted || signal?.aborted)
      return;
    if (pendingTemplateMarkerId === marker.id)
      return;
    clearPendingFrameTemplateWatch();
    pendingTemplateMarkerId = marker.id;
    let early = consumeFrameTemplate(marker.id) ?? getEarlyFrameContent(marker.id);
    if (early) {
      clearPendingFrameTemplateWatch();
      await render(early, { reconciliationTracker, signal, contentStatus: "resolved" });
      if (!disposed && !context.lifecycleSignal.aborted && !signal?.aborted)
        onResolved?.();
      return;
    }
    if (disposed || context.lifecycleSignal.aborted || signal?.aborted) {
      clearPendingFrameTemplateWatch();
      return;
    }
    let observer = setupTemplateObserver();
    pendingTemplateObserver = observer;
    let unsubscribe = subscribeFrameTemplate(marker.id, async (fragment) => {
      if (disposed || context.lifecycleSignal.aborted || signal?.aborted)
        return;
      if (pendingTemplateMarkerId !== marker.id)
        return;
      clearPendingFrameTemplateWatch();
      await render(fragment, { signal, contentStatus: "resolved" });
      if (!disposed && !context.lifecycleSignal.aborted && !signal?.aborted)
        onResolved?.();
    });
    pendingTemplateUnsubscribe = unsubscribe;
    signal?.addEventListener("abort", () => {
      if (pendingTemplateMarkerId === marker.id) {
        clearPendingFrameTemplateWatch();
      }
    }, { once: true });
    let buffered = consumeFrameTemplate(marker.id);
    if (buffered) {
      clearPendingFrameTemplateWatch();
      await render(buffered, { reconciliationTracker, signal, contentStatus: "resolved" });
      if (!disposed && !context.lifecycleSignal.aborted && !signal?.aborted)
        onResolved?.();
    }
  }
}
function createFrameRuntime(init) {
  return {
    [FRAME_RUNTIME]: true,
    topFrame: init.topFrame,
    getContext: init.getContext,
    errorTarget: init.errorTarget,
    loadModule: init.loadModule,
    resolveFrame: init.resolveFrame,
    pendingClientEntries: init.pendingClientEntries,
    scheduler: init.scheduler,
    styleManager: init.styleManager,
    moduleCache: init.moduleCache,
    moduleLoads: init.moduleLoads,
    frameInstances: init.frameInstances,
    namedFrames: init.namedFrames,
    processClientEntryPreloads: init.processClientEntryPreloads,
    serverFrameReload: void 0,
    reloadForNavigation: init.reloadForNavigation
  };
}
function createReconciliationTracker() {
  let pending = 0;
  let finalized = false;
  let failed = false;
  let failure;
  let resolveReady;
  let rejectReady;
  let readyPromise = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  function maybeSettle() {
    if (!finalized || pending !== 0)
      return;
    if (failed)
      rejectReady?.(failure);
    else
      resolveReady?.();
    resolveReady = void 0;
    rejectReady = void 0;
  }
  function track() {
    pending++;
    let completed = false;
    return () => {
      if (completed)
        return;
      completed = true;
      pending--;
      maybeSettle();
    };
  }
  return {
    track,
    waitFor(task) {
      let complete = track();
      void task.then(complete, (error) => {
        if (!failed) {
          failed = true;
          failure = error;
        }
        complete();
      });
    },
    finalize() {
      finalized = true;
      maybeSettle();
    },
    ready() {
      return readyPromise;
    }
  };
}
function mergeRmxDataFromDocument(into, doc) {
  let scripts = Array.from(doc.querySelectorAll("script#rmx-data"));
  for (let script of scripts) {
    if (!(script instanceof HTMLScriptElement))
      continue;
    mergeRmxData(into, parseRmxDataScript(script));
    script.remove();
  }
}
function mergeRmxDataFromFragment(into, fragment) {
  let scripts = Array.from(fragment.querySelectorAll("script#rmx-data"));
  for (let script of scripts) {
    if (!(script instanceof HTMLScriptElement))
      continue;
    mergeRmxData(into, parseRmxDataScript(script));
    script.remove();
  }
}
function clearRmxData(data) {
  delete data.h;
  delete data.f;
}
function removeEmptyHeads(fragment) {
  let heads = Array.from(fragment.querySelectorAll("head"));
  for (let head of heads) {
    if (!head.childNodes.length) {
      head.remove();
    }
  }
}
function collectFrameServerStyleTags(container) {
  let styles = [];
  let nodes = container.root instanceof Document ? [...Array.from(container.doc.head.childNodes), ...Array.from(container.doc.body.childNodes)] : container.childNodes;
  collectOwnedServerStyleTags(nodes, styles);
  return styles;
}
function collectOwnedServerStyleTags(nodes, styles) {
  for (let i = 0; i < nodes.length; i++) {
    let node = nodes[i];
    if (isFrameStart(node)) {
      let end = findEndMarker(node, isFrameStart, isFrameEnd);
      i = findMarkerRangeEndIndex(nodes, end, i);
      continue;
    }
    if (node instanceof HTMLStyleElement && node.matches("style[data-rmx-style]")) {
      styles.push(node);
      continue;
    }
    if (node.childNodes.length > 0) {
      collectOwnedServerStyleTags(Array.from(node.childNodes), styles);
    }
  }
}
function parseRmxDataScript(script) {
  try {
    return JSON.parse(script.textContent || "{}");
  } catch {
    console.error("[createFrame] Failed to parse rmx-data script");
    return {};
  }
}
function mergeRmxData(into, from) {
  if (from.h) {
    if (!into.h)
      into.h = {};
    copyOwnRmxEntries(into.h, from.h);
  }
  if (from.f) {
    if (!into.f)
      into.f = {};
    copyOwnRmxEntries(into.f, from.f);
  }
}
function copyOwnRmxEntries(target, source) {
  for (let key of Object.keys(source)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype")
      continue;
    if (!Object.hasOwn(source, key))
      continue;
    target[key] = source[key];
  }
}
function hydrateContainer(container, context, options) {
  let hydrationData = context.data.h;
  let hydrationMarkers = findHydrationMarkers(container, hydrationData);
  let hydrations = [];
  for (let marker of hydrationMarkers) {
    let entry = hydrationData?.[marker.id];
    if (!entry)
      continue;
    if (!context.pendingClientEntries.has(marker.start)) {
      context.pendingClientEntries.set(marker.start, [marker.end, void 0]);
    }
    let { promise, resolve } = Promise.withResolvers();
    pendingClientEntryHydrations.set(marker.start, promise);
    hydrations.push({
      marker,
      entry,
      complete() {
        if (pendingClientEntryHydrations.get(marker.start) === promise) {
          pendingClientEntryHydrations.delete(marker.start);
        }
        resolve();
      }
    });
  }
  let subFramesReady = createSubFrames(container.childNodes, context, options);
  for (let { marker, entry, complete } of hydrations) {
    scheduleHydrationMarker(marker, entry, context, complete, options?.reconciliationTracker, options?.signal);
  }
  return subFramesReady;
}
function scheduleHydrationMarker(marker, entry, context, onComplete, reconciliationTracker, signal) {
  if (signal?.aborted || context.lifecycleSignal.aborted) {
    onComplete();
    return;
  }
  let done = reconciliationTracker?.track();
  let key = `${entry.moduleUrl}#${entry.exportName}`;
  let identity = {
    moduleUrl: entry.moduleUrl,
    exportName: entry.exportName
  };
  let props = entry.props;
  let completed = false;
  let complete = () => {
    if (completed)
      return;
    completed = true;
    props = void 0;
    signal?.removeEventListener("abort", complete);
    context.lifecycleSignal.removeEventListener("abort", complete);
    onComplete();
    done?.();
  };
  signal?.addEventListener("abort", complete, { once: true });
  context.lifecycleSignal.addEventListener("abort", complete, { once: true });
  let hydrateWithComponent = (component2) => {
    if (signal?.aborted || context.lifecycleSignal.aborted)
      return;
    if (!isHydrationMarkerLive(marker, context))
      return;
    if (!props)
      return;
    let pending = context.pendingClientEntries.get(marker.start);
    let vElement = pending?.[1] ?? createElement(component2, props);
    context.pendingClientEntries.set(marker.start, [marker.end, vElement]);
    hydrateRegion(vElement, marker.start, marker.end, identity, context, signal);
  };
  let parentHydration = marker.parent && pendingClientEntryHydrations.get(marker.parent);
  let cached = context.moduleCache.get(key);
  if (cached && !parentHydration) {
    hydrateWithComponent(cached);
    complete();
    return;
  }
  let component = cached ?? getOrStartModuleLoad(key, identity, marker.id, context);
  Promise.all([component, parentHydration]).then(([component2]) => {
    if (component2) {
      hydrateWithComponent(component2);
    }
  }).finally(() => {
    complete();
  });
}
function getOrStartModuleLoad(key, identity, markerId, context) {
  let inFlight = context.moduleLoads.get(key);
  if (inFlight)
    return inFlight;
  let loadPromise = (async () => {
    try {
      let mod = await context.loadModule(identity.moduleUrl, identity.exportName);
      if (!isElementFunction3(mod)) {
        throw new Error(`Export "${identity.exportName}" from "${identity.moduleUrl}" is not a function`);
      }
      context.moduleCache.set(key, mod);
      return mod;
    } catch (error) {
      console.error(`[createFrame] Failed to load module for ${markerId}:`, error);
      return void 0;
    } finally {
      context.moduleLoads.delete(key);
    }
  })();
  context.moduleLoads.set(key, loadPromise);
  return loadPromise;
}
function createElement(component, props) {
  let revivedProps = reviveSerializedValue(props);
  invariant(isRecord(revivedProps), "Expected revived component props to be an object");
  return jsx(component, revivedProps);
}
function isElementFunction3(value) {
  return typeof value === "function";
}
function reviveSerializedValue(value) {
  if (value === null || value === void 0)
    return value;
  if (typeof value !== "object")
    return value;
  if (Array.isArray(value)) {
    return value.map((item) => reviveSerializedValue(item));
  }
  if (!isRecord(value))
    return value;
  let record = value;
  if (record.$rmxFrame === true) {
    let props = reviveSerializedObject(record.props);
    let key = reviveSerializedValue(record.key);
    return jsx(Frame, props, key);
  }
  if (record.$rmx === true && typeof record.type === "string") {
    let props = reviveSerializedObject(record.props);
    let key = reviveSerializedValue(record.key);
    return jsx(record.type, props, key);
  }
  let revived = {};
  for (let key in record) {
    revived[key] = reviveSerializedValue(record[key]);
  }
  return revived;
}
function reviveSerializedObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return {};
  let revived = reviveSerializedValue(value);
  if (!revived || typeof revived !== "object" || Array.isArray(revived))
    return {};
  return isRecord(revived) ? revived : {};
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function hydrateRegion(vElement, start, end, identity, context, signal) {
  if (signal?.aborted)
    return;
  context.pendingClientEntries.delete(start);
  let renderEntry = (root2) => {
    if (!signal) {
      root2.render(vElement);
      return;
    }
    let frameRuntime = context.frame.$runtime;
    invariant(isFrameRuntime(frameRuntime), "Expected frame runtime while rendering a client entry during a reload");
    let previousServerFrameReload = frameRuntime.serverFrameReload;
    frameRuntime.serverFrameReload = {
      signal,
      reconciliationTracker: context.reconciliationTracker,
      blockingFrameTracker: context.blockingFrameTracker
    };
    try {
      root2.render(vElement);
    } finally {
      frameRuntime.serverFrameReload = previousServerFrameReload;
    }
  };
  let owner = getClientEntryBoundaryOwner(start);
  if (owner) {
    renderEntry(owner.root);
    return;
  }
  let root = createRangeRoot([start, end], {
    scheduler: context.scheduler,
    frame: context.frame,
    getContext: context.getContext,
    styleManager: context.styleManager
  });
  root.addEventListener("error", (event) => {
    if (context.errorTarget === root)
      return;
    context.errorTarget.dispatchEvent(createComponentErrorEvent(getComponentError(event)));
  });
  setClientEntryBoundaryOwner(start, end, identity, root);
  renderEntry(root);
}
async function createSubFrames(nodes, context, options) {
  let tasks = [];
  for (let i = 0; i < nodes.length; i++) {
    if (options?.signal?.aborted)
      break;
    let node = nodes[i];
    if (isFrameStart(node)) {
      let end = findEndMarker(node, isFrameStart, isFrameEnd);
      let existingFrame = context.frameInstances.get(node);
      let id = getFrameId2(node);
      let marker = context.data.f?.[id];
      if (existingFrame) {
        if (marker) {
          let frameMarker = { ...marker, id };
          tasks.push(existingFrame.updateMarker(frameMarker, options));
        } else {
          existingFrame.clearPendingTemplateWatch();
        }
      } else {
        if (marker) {
          let frameMarker = { ...marker, id };
          let subFrame = createFrame([node, end], {
            src: frameMarker.src,
            marker: frameMarker,
            topFrame: context.topFrame,
            getContext: context.getContext,
            errorTarget: context.errorTarget,
            loadModule: context.loadModule,
            resolveFrame: context.resolveFrame,
            pendingClientEntries: context.pendingClientEntries,
            scheduler: context.scheduler,
            styleManager: context.styleManager,
            data: context.data,
            moduleCache: context.moduleCache,
            moduleLoads: context.moduleLoads,
            frameInstances: context.frameInstances,
            namedFrames: context.namedFrames,
            processClientEntryPreloads: context.processClientEntryPreloads
          });
          context.frameInstances.set(node, subFrame);
          if (frameMarker.status === "resolved") {
            tasks.push(subFrame.ready());
          }
        }
      }
      i = findMarkerRangeEndIndex(nodes, end, i);
      continue;
    }
    if (node.childNodes && node.childNodes.length > 0) {
      tasks.push(createSubFrames(Array.from(node.childNodes), context, options));
    }
  }
  await Promise.all(tasks);
}
function isHydrationMarkerLive(marker, context) {
  if (!marker.start.isConnected || !marker.end.isConnected)
    return false;
  if (marker.start.parentNode !== marker.end.parentNode)
    return false;
  let startText = marker.start.data.trim();
  if (startText !== `rmx:h:${marker.id}`)
    return false;
  if (marker.end.data.trim() !== "/rmx:h")
    return false;
  let parent = marker.start.parentNode;
  if (!parent)
    return false;
  if (context.regionTailRef) {
    let startPosition = marker.start.compareDocumentPosition(context.regionTailRef);
    let endPosition = marker.end.compareDocumentPosition(context.regionTailRef);
    let tailFollowsStart = (startPosition & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    let tailFollowsEnd = (endPosition & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    if (!tailFollowsStart || !tailFollowsEnd)
      return false;
  }
  return true;
}
function removeVirtualRoots(nodes) {
  for (let i = 0; i < nodes.length; i++) {
    let node = nodes[i];
    if (isCommentNode3(node) && isHydrationStart(node) && disposeClientEntryBoundary(node)) {
      let end = findEndMarker(node, isHydrationStart, isHydrationEnd);
      i = findMarkerRangeEndIndex(nodes, end, i);
      continue;
    }
    if (node.childNodes && node.childNodes.length > 0) {
      removeVirtualRoots(Array.from(node.childNodes));
    }
  }
}
function disposeSubFrames(nodes, context) {
  for (let i = 0; i < nodes.length; i++) {
    let node = nodes[i];
    if (isFrameStart(node)) {
      let end = findEndMarker(node, isFrameStart, isFrameEnd);
      let subFrame = context.frameInstances.get(node);
      if (subFrame) {
        subFrame.dispose();
        context.frameInstances.delete(node);
      }
      i = findMarkerRangeEndIndex(nodes, end, i);
      continue;
    }
    if (node.childNodes && node.childNodes.length > 0) {
      disposeSubFrames(Array.from(node.childNodes), context);
    }
  }
}
function getEarlyFrameContent(id) {
  let template = document.querySelector(`template#${id}`);
  if (template instanceof HTMLTemplateElement) {
    let fragment = template.content;
    template.remove();
    return fragment;
  }
  return null;
}
function setupTemplateObserver() {
  let root = document.body ?? document.documentElement ?? document;
  let observer = new MutationObserver((mutations) => {
    for (let mutation of mutations) {
      for (let node of mutation.addedNodes) {
        collectAndPublishTemplates(node);
      }
    }
  });
  observer.observe(root, { childList: true, subtree: true });
  return observer;
}
function collectAndPublishTemplates(node) {
  if (node instanceof HTMLTemplateElement) {
    publishFrameTemplateElement(node);
    return;
  }
  if (!(node instanceof Element))
    return;
  let templates = Array.from(node.querySelectorAll("template"));
  for (let template of templates) {
    if (!(template instanceof HTMLTemplateElement))
      continue;
    publishFrameTemplateElement(template);
  }
}
function publishFrameTemplateElement(template) {
  if (!template.id)
    return;
  template.remove();
  publishFrameTemplate(template.id, template.content);
}
function publishFrameTemplate(id, fragment) {
  let listeners = frameTemplateListeners.get(id);
  if (!listeners || listeners.size === 0) {
    let queue = bufferedFrameTemplates.get(id);
    if (!queue) {
      queue = [];
      bufferedFrameTemplates.set(id, queue);
    }
    queue.push(fragment);
    return;
  }
  for (let listener of listeners) {
    let clone = fragment.cloneNode(true);
    invariant(isDocumentFragmentNode(clone), "Expected cloned frame template fragment");
    listener(clone);
  }
}
function consumeFrameTemplate(id) {
  let queue = bufferedFrameTemplates.get(id);
  if (!queue || queue.length === 0)
    return null;
  let fragment = queue.shift() ?? null;
  if (queue.length === 0) {
    bufferedFrameTemplates.delete(id);
  }
  return fragment;
}
function subscribeFrameTemplate(id, listener) {
  let listeners = frameTemplateListeners.get(id);
  if (!listeners) {
    listeners = /* @__PURE__ */ new Set();
    frameTemplateListeners.set(id, listeners);
  }
  listeners.add(listener);
  return () => {
    let current = frameTemplateListeners.get(id);
    if (!current)
      return;
    current.delete(listener);
    if (current.size === 0) {
      frameTemplateListeners.delete(id);
    }
  };
}
var COMPLETE_TEMPLATE_WITH_ID_PATTERN = /<template\b[^>]*\bid=(?:"([^"]+)"|'([^']+)')[^>]*>[\s\S]*?<\/template>/gi;
function extractTemplatesFromBuffer(doc, buffer, onTemplate) {
  let html = "";
  let cursor = 0;
  let hadMatch = false;
  COMPLETE_TEMPLATE_WITH_ID_PATTERN.lastIndex = 0;
  let match = COMPLETE_TEMPLATE_WITH_ID_PATTERN.exec(buffer);
  while (match) {
    hadMatch = true;
    let index = match.index;
    let fullMatch = match[0];
    let id = match[1] ?? match[2];
    let matchEnd = index + fullMatch.length;
    html += buffer.slice(cursor, index);
    if (id) {
      let parsed = createFragmentFromString(doc, fullMatch);
      let template = parsed.querySelector("template");
      if (template instanceof HTMLTemplateElement && template.id) {
        onTemplate(template.id, template.content);
      }
    }
    cursor = matchEnd;
    match = COMPLETE_TEMPLATE_WITH_ID_PATTERN.exec(buffer);
  }
  let tail = buffer.slice(cursor);
  if (tail === "")
    return { html, remainder: "" };
  let tailStart = tail.toLowerCase().lastIndexOf("<template");
  if (tailStart === -1) {
    return { html: html + tail, remainder: "" };
  }
  if (!hadMatch) {
    return {
      html: buffer.slice(0, tailStart),
      remainder: buffer.slice(tailStart)
    };
  }
  return {
    html: html + tail.slice(0, tailStart),
    remainder: tail.slice(tailStart)
  };
}
async function renderFrameStream(stream, doc, applyHtml, signal) {
  let reader = stream.getReader();
  let decoder = new TextDecoder();
  let buffer = "";
  let html = "";
  let appliedOnce = false;
  let abort = () => {
    void reader.cancel().catch(() => {
    });
  };
  if (signal?.aborted) {
    await reader.cancel();
    reader.releaseLock();
    return;
  }
  signal?.addEventListener("abort", abort, { once: true });
  try {
    while (true) {
      let { done, value } = await reader.read();
      if (done)
        break;
      buffer += decoder.decode(value, { stream: true });
      let parsed2 = extractTemplatesFromBuffer(doc, buffer, publishFrameTemplate);
      buffer = parsed2.remainder;
      if (parsed2.html !== "") {
        html += parsed2.html;
        let flushed = await consumeFlushBatches(html, applyHtml);
        appliedOnce = flushed.applied || appliedOnce;
        html = flushed.remainder;
      }
    }
    buffer += decoder.decode();
    let parsed = extractTemplatesFromBuffer(doc, buffer, publishFrameTemplate);
    html += parsed.html;
    buffer = parsed.remainder;
    if (buffer !== "") {
      html += buffer;
      buffer = "";
    }
    if (html !== "") {
      await applyHtml(html, appliedOnce ? "fragment" : inferFlushKind(html));
      appliedOnce = true;
    }
    if (html === "" && !appliedOnce) {
      await applyHtml("", "fragment");
    }
  } finally {
    signal?.removeEventListener("abort", abort);
    reader.releaseLock();
  }
}
async function consumeFlushBatches(html, applyHtml) {
  let applied = false;
  let cursor = 0;
  let marker = findFlushMarker(html, cursor);
  while (marker) {
    let batch = html.slice(cursor, marker.index);
    await applyHtml(batch, marker.kind);
    applied = true;
    cursor = marker.endIndex;
    marker = findFlushMarker(html, cursor);
  }
  return { applied, remainder: html.slice(cursor) };
}
function createContainer(root) {
  return Array.isArray(root) ? createCommentContainer(root) : createElementContainer(root);
}
function createElementContainer(root) {
  let doc = root instanceof Document ? root : root.ownerDocument ?? document;
  return {
    doc,
    root,
    get childNodes() {
      return Array.from(root.childNodes);
    }
  };
}
function createCommentContainer([start, end]) {
  let parent = end.parentNode;
  invariant(parent, "Invalid comment container");
  invariant(start.parentNode === parent, "Boundaries must share parent");
  let doc = parent.ownerDocument ?? document;
  let getChildNodesBetween = () => {
    let nodes = [];
    let node = start.nextSibling;
    while (node && node !== end) {
      nodes.push(node);
      node = node.nextSibling;
    }
    return nodes;
  };
  return {
    doc,
    root: parent,
    regionStart: start,
    get childNodes() {
      return getChildNodesBetween();
    },
    regionTailRef: end,
    regionParent: parent
  };
}
function createFragmentFromString(doc, content) {
  let template = doc.createElement("template");
  template.innerHTML = stripDoctypeMarkup(content).trim();
  return template.content;
}
function isRemixNodeFrameContent(content) {
  return !(content instanceof ReadableStream || isDocumentFragmentNode(content) || typeof content === "string");
}
function findHydrationMarkers(container, data) {
  let markers = [];
  let parent = container.regionStart && frameClientEntryParents.get(container.regionStart);
  visit(container.childNodes, parent);
  return markers.map(({ id, start, end, parent: parent2 }) => {
    if (!end)
      throw new Error("End marker not found");
    return { id, start, end, parent: parent2 };
  });
  function visit(nodes, parent2) {
    let boundaries = [];
    for (let i = 0; i < nodes.length; i++) {
      let node = nodes[i];
      if (isFrameStart(node)) {
        if (parent2)
          frameClientEntryParents.set(node, parent2);
        else
          frameClientEntryParents.delete(node);
        let end = findEndMarker(node, isFrameStart, isFrameEnd);
        i = findMarkerRangeEndIndex(nodes, end, i);
        continue;
      }
      if (isCommentNode3(node)) {
        if (isHydrationStart(node)) {
          let id = node.data.trim().slice("rmx:h:".length);
          let boundary = { id, start: node, parent: parent2 };
          markers.push(boundary);
          boundaries.push(boundary);
          if (data?.[id] || pendingClientEntryHydrations.has(node))
            parent2 = node;
        } else if (isHydrationEnd(node)) {
          let boundary = boundaries.pop();
          if (boundary) {
            boundary.end = node;
            parent2 = boundary.parent;
          }
        }
      }
      if (node.childNodes.length > 0) {
        visit(Array.from(node.childNodes), parent2);
      }
    }
  }
}
function isHydrationStart(node) {
  return node.data.trim().startsWith("rmx:h:");
}
function isHydrationEnd(node) {
  return node.data.trim() === "/rmx:h";
}
function isFrameStart(node) {
  return isCommentNode3(node) && node.data.trim().startsWith("rmx:f:");
}
function isFrameEnd(node) {
  return node.data.trim() === "/rmx:f";
}
function getFrameId2(start) {
  let trimmed = start.data.trim();
  invariant(trimmed.startsWith("rmx:f:"), "Invalid frame start marker");
  return trimmed.slice("rmx:f:".length);
}
function findMarkerRangeEndIndex(nodes, end, startIndex) {
  return Math.max(startIndex, nodes.indexOf(end, startIndex));
}
function findEndMarker(start, isStart, isEnd) {
  let node = start.nextSibling;
  let depth = 1;
  while (node) {
    if (isCommentNode3(node)) {
      let comment = node;
      if (isStart(comment))
        depth++;
      else if (isEnd(comment)) {
        depth--;
        if (depth === 0)
          return comment;
      }
    }
    node = node.nextSibling;
  }
  throw new Error("End marker not found");
}
function isCommentNode3(node) {
  return node?.nodeType === Node.COMMENT_NODE;
}
function isDocumentNode(node) {
  return node.nodeType === Node.DOCUMENT_NODE;
}
function isDocumentFragmentNode(value) {
  return typeof value === "object" && value !== null && Reflect.get(value, "nodeType") === Node.DOCUMENT_FRAGMENT_NODE;
}

// node_modules/@remix-run/component/dist/runtime/form-navigation.js
var PENDING_FORM_SUBMISSION_TIMEOUT = 1e3;
function createFormNavigationResolver(signal) {
  let pendingFormSubmissions = /* @__PURE__ */ new WeakMap();
  document.addEventListener("submit", (event) => {
    let form = event.target;
    if (!(form instanceof HTMLFormElement))
      return;
    let existing = pendingFormSubmissions.get(form);
    if (existing) {
      clearTimeout(existing.timeout);
      existing.removeFormDataListener();
    }
    let eventSubmitter = event instanceof SubmitEvent ? event.submitter : null;
    let submitter = eventSubmitter instanceof HTMLButtonElement || eventSubmitter instanceof HTMLInputElement ? eventSubmitter : null;
    let removeFormDataListener = () => {
    };
    let method = getFormMethod(form, submitter).toLowerCase();
    if (method === "post" && form.method.toLowerCase() !== "post") {
      let onFormData = (event2) => {
        let pending2 = pendingFormSubmissions.get(form);
        if (pending2)
          pending2.formData = event2.formData;
      };
      form.addEventListener("formdata", onFormData, { signal });
      removeFormDataListener = () => form.removeEventListener("formdata", onFormData);
    }
    let pending = {
      submitter,
      timeout: setTimeout(() => {
        if (pendingFormSubmissions.get(form) === pending) {
          pendingFormSubmissions.delete(form);
        }
        pending.removeFormDataListener();
      }, PENDING_FORM_SUBMISSION_TIMEOUT),
      removeFormDataListener
    };
    pendingFormSubmissions.set(form, pending);
  }, { capture: true, signal });
  return (event) => {
    let sourceElement = event.sourceElement;
    if (!(sourceElement instanceof Element))
      return;
    let form = getSourceForm(sourceElement);
    if (!form)
      return;
    let pending = pendingFormSubmissions.get(form);
    let submitter = pending?.submitter ?? null;
    let method = getFormMethod(form, submitter);
    let encType = getFormEncType(form, submitter);
    let target = getSubmissionAttribute(form, submitter, "target", "formtarget");
    if (method === "dialog" || target?.toLowerCase() === "_blank")
      return;
    let formEvent = event;
    let clearPending = () => {
      if (!pending)
        return;
      clearTimeout(pending.timeout);
      pending.removeFormDataListener();
      if (pendingFormSubmissions.get(form) === pending) {
        pendingFormSubmissions.delete(form);
      }
    };
    let getSubmission;
    if (method.toLowerCase() === "get") {
      clearPending();
    } else {
      getSubmission = async () => {
        if (!formEvent.formData && pending && !pending.formData) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
        clearPending();
        return {
          formData: formEvent.formData ?? pending?.formData,
          method,
          encType
        };
      };
    }
    return {
      hasAttribute(name) {
        return submitter?.hasAttribute(name) === true || form.hasAttribute(name);
      },
      getAttribute(name, submitterName) {
        return getSubmissionAttribute(form, submitter, name, submitterName);
      },
      getSubmission
    };
  };
}
function getSourceForm(sourceElement) {
  if (sourceElement instanceof HTMLFormElement)
    return sourceElement;
  if (sourceElement instanceof HTMLButtonElement || sourceElement instanceof HTMLInputElement) {
    return sourceElement.form ?? void 0;
  }
}
function getSubmissionAttribute(form, submitter, name, submitterName) {
  submitterName ??= name;
  if (submitter?.hasAttribute(submitterName)) {
    return submitter.getAttribute(submitterName);
  }
  return form.getAttribute(name);
}
function getFormMethod(form, submitter) {
  if (submitter?.hasAttribute("formmethod")) {
    return submitter.formMethod;
  }
  return form.method;
}
function getFormEncType(form, submitter) {
  if (submitter?.hasAttribute("formenctype")) {
    return submitter.formEnctype;
  }
  return form.enctype;
}

// node_modules/@remix-run/component/dist/runtime/navigation.js
var formSubmissionNavigationInfoType = /* @__PURE__ */ Symbol("frame-form-submission");
var frameRedirectNavigationInfoType = "frame-redirect";
function resyncWebKitScrollAfterNavigation(event, resetScroll, transition) {
  let userAgent = navigator.userAgent;
  if (!userAgent.includes("AppleWebKit") || isChromiumUserAgent(userAgent))
    return;
  if (!resetScroll || event.navigationType !== "push" && event.navigationType !== "replace")
    return;
  if (new URL(event.destination.url).hash)
    return;
  void transition.finished.then(() => {
    if (event.signal.aborted || window.scrollX !== 0 || window.scrollY !== 0)
      return;
    window.scrollTo({ behavior: "instant", left: 0, top: 1 });
    requestAnimationFrame(() => {
      if (event.signal.aborted || window.scrollX !== 0 || window.scrollY !== 1)
        return;
      window.scrollTo({ behavior: "instant", left: 0, top: 0 });
    });
  }, () => {
  });
}
function startNavigationListener(signal) {
  return startNavigationListenerImpl(signal, {
    getTopFrame,
    getNamedFrame,
    reloadFrame: reloadFrameForNavigation
  });
}
function startNavigationListenerImpl(signal, options) {
  let navigation = getInterceptableNavigation();
  if (!navigation)
    return;
  let resolveFormNavigation = createFormNavigationResolver(signal);
  let needsFrameReload = false;
  navigation.updateCurrentEntry({
    state: { target: void 0, src: window.location.href, resetScroll: true, $rmx: true }
  });
  navigation.addEventListener("navigate", (event) => {
    if (isDocumentReload(event.info) || event.hashChange && !needsFrameReload || event.downloadRequest != null || !event.canIntercept || // Safari seems to incorrectly set canIntercept to true for sub-domain navigations, so
    // we do an origin check ourselves. The spec is clear that a different host should prevent
    // interception so this is likely a bug in Safari:
    // https://html.spec.whatwg.org/multipage/nav-history-apis.html#can-have-its-url-rewritten
    !isSameOriginUrl(event.destination.url)) {
      return;
    }
    if (isFrameRedirectNavigationInfo(event.info)) {
      interceptNavigation(navigation, event, event.info.resetScroll, {
        async handler() {
        },
        scroll: "manual"
      });
      return;
    }
    let replayedSubmission = isFormSubmissionNavigationInfo(event.info) ? event.info : void 0;
    let runtimeNavigation = replayedSubmission ? {
      state: replayedSubmission.state,
      getSubmission: replayedSubmission.getSubmission
    } : getRuntimeNavigation(navigation, event, resolveFormNavigation);
    if (!runtimeNavigation)
      return;
    let { state } = runtimeNavigation;
    if (!isSameOriginUrl(state.src)) {
      fallbackToDocumentNavigation(navigation, event);
      return;
    }
    let topFrame2 = options.getTopFrame();
    let frame = replayedSubmission?.frame;
    if (!frame) {
      if (state.target) {
        frame = options.getNamedFrame(state.target);
        if (!frame) {
          fallbackToDocumentNavigation(navigation, event);
          return;
        }
      } else {
        frame = topFrame2;
      }
    }
    needsFrameReload = true;
    let handler = async () => {
      if (event.signal.aborted)
        return;
      let submission = await runtimeNavigation.getSubmission?.();
      if (event.signal.aborted)
        return;
      if (event.navigationType !== "traverse") {
        navigation.updateCurrentEntry({ state });
      }
      topFrame2.src = event.destination.url;
      if (frame !== topFrame2)
        frame.src = state.src;
      let reload = options.reloadFrame(frame, {
        ...submission,
        signal: event.signal
      });
      await reload.committed;
      if (event.signal.aborted || reload.signal.aborted)
        return;
      if (state.resetScroll)
        event.scroll();
      let { redirectedTo } = await reload.finished;
      if (event.signal.aborted || reload.signal.aborted)
        return;
      needsFrameReload = false;
      if (redirectedTo && frame === topFrame2) {
        frame.src = redirectedTo;
        navigation.navigate(redirectedTo, {
          history: "replace",
          state: { ...state, src: redirectedTo },
          info: {
            type: frameRedirectNavigationInfoType,
            resetScroll: state.resetScroll
          }
        });
      }
    };
    let interceptOptions = {
      handler,
      scroll: state.resetScroll === false ? "manual" : void 0
    };
    if (runtimeNavigation.getSubmission) {
      if (runtimeNavigation.replaceHistory && replayedSubmission == null) {
        let supportsPrecommit = typeof Reflect.get(window, "NavigationPrecommitController") === "function";
        if (supportsPrecommit) {
          interceptNavigation(navigation, event, state.resetScroll, {
            ...interceptOptions,
            precommitHandler(controller) {
              controller.redirect(event.destination.url, { history: "replace" });
            }
          });
          return;
        }
        if (event.cancelable) {
          event.preventDefault();
          navigation.navigate(event.destination.url, {
            history: "replace",
            state,
            info: {
              type: formSubmissionNavigationInfoType,
              state,
              frame,
              getSubmission: runtimeNavigation.getSubmission
            }
          });
          return;
        }
      }
      interceptNavigation(navigation, event, state.resetScroll, interceptOptions);
    } else {
      if (runtimeNavigation.replaceHistory && event.cancelable) {
        event.preventDefault();
        navigation.navigate(event.destination.url, { history: "replace", state });
      } else {
        interceptNavigation(navigation, event, state.resetScroll, interceptOptions);
      }
    }
  }, { signal });
}
function getInterceptableNavigation() {
  let navigation = window.navigation;
  if (!navigation || typeof NavigateEvent === "undefined" || !("sourceElement" in NavigateEvent.prototype)) {
    return;
  }
  return navigation;
}
function isRuntimeNavigation(info) {
  return typeof info === "object" && info != null && "$rmx" in info;
}
function isFormSubmissionNavigationInfo(value) {
  return typeof value === "object" && value != null && "type" in value && value.type === formSubmissionNavigationInfoType && "state" in value && isRuntimeNavigation(value.state) && "frame" in value && "getSubmission" in value && typeof value.getSubmission === "function";
}
function isFrameRedirectNavigationInfo(value) {
  return typeof value === "object" && value != null && "type" in value && value.type === frameRedirectNavigationInfoType && "resetScroll" in value && typeof value.resetScroll === "boolean";
}
function isSameOriginUrl(src) {
  try {
    return new URL(src, document.baseURI).origin === window.location.origin;
  } catch {
    return false;
  }
}
function fallbackToDocumentNavigation(navigation, event) {
  if (event.navigationType !== "traverse")
    return;
  interceptNavigation(navigation, event, false, {
    scroll: "manual",
    handler() {
      if (!event.signal.aborted)
        reloadCurrentDocument(document);
    }
  });
}
function interceptNavigation(navigation, event, resetScroll, options) {
  let scrollStyleWorkarounds = installNavigationScrollStyleWorkarounds(event, resetScroll);
  let transitionBound = false;
  function bindTransition() {
    if (transitionBound)
      return;
    if (event.signal.aborted)
      return scrollStyleWorkarounds?.remove();
    let transition = navigation.transition;
    if (!transition)
      return scrollStyleWorkarounds?.remove();
    transitionBound = true;
    resyncWebKitScrollAfterNavigation(event, resetScroll, transition);
    if (scrollStyleWorkarounds) {
      scheduleNavigationScrollCleanup(transition, scrollStyleWorkarounds.remove, scrollStyleWorkarounds.cleanup);
    }
  }
  let interceptOptions = {
    ...options,
    handler() {
      bindTransition();
      return options.handler?.();
    }
  };
  let precommitHandler = options.precommitHandler;
  if (precommitHandler) {
    interceptOptions.precommitHandler = function precommit(controller) {
      bindTransition();
      return precommitHandler(controller);
    };
  }
  try {
    event.intercept(interceptOptions);
  } catch (error) {
    scrollStyleWorkarounds?.remove();
    throw error;
  }
}
function getNavigationScrollStyles(event, resetScroll) {
  if (!resetScroll)
    return;
  if (event.navigationType === "traverse") {
    let { scrollHeight, clientHeight } = document.documentElement;
    return {
      cssText: `
        html {
          min-height: ${scrollHeight + clientHeight}px !important;
          overflow-anchor: none !important;
        }

        body {
          overflow-anchor: none !important;
        }
      `,
      cleanup: "finished"
    };
  }
  if (event.navigationType !== "push" && event.navigationType !== "replace")
    return;
  if (new URL(event.destination.url).hash)
    return;
  if (!isChromiumUserAgent(navigator.userAgent))
    return;
  return {
    cssText: `
      html,
      body {
        overflow-anchor: none !important;
      }
    `,
    cleanup: "after-paint"
  };
}
function isChromiumUserAgent(userAgent) {
  return userAgent.includes("Chrome") || userAgent.includes("Chromium");
}
function installNavigationScrollStyleWorkarounds(event, resetScroll) {
  let scrollStyles = getNavigationScrollStyles(event, resetScroll);
  if (!scrollStyles)
    return;
  let stylesheet = new CSSStyleSheet();
  stylesheet.replaceSync(scrollStyles.cssText);
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet];
  let removed = false;
  function remove2() {
    event.signal.removeEventListener("abort", remove2);
    if (removed)
      return;
    removed = true;
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter((current) => current !== stylesheet);
  }
  if (event.signal.aborted)
    remove2();
  else
    event.signal.addEventListener("abort", remove2, { once: true });
  return { remove: remove2, cleanup: scrollStyles.cleanup };
}
function scheduleNavigationScrollCleanup(transition, removeScrollStyles, cleanup) {
  function removeAfterSuccess() {
    if (cleanup === "finished")
      return removeScrollStyles();
    requestAnimationFrame(() => requestAnimationFrame(removeScrollStyles));
  }
  void transition.finished.then(removeAfterSuccess, removeScrollStyles);
}
function getRuntimeNavigation(navigation, event, resolveFormNavigation) {
  if (event.navigationType === "traverse") {
    let state = getTraverseNavigationState(navigation, event);
    return state ? { state } : void 0;
  }
  let sourceNavigation = getSourceElementNavigation(navigation, event, resolveFormNavigation);
  if (sourceNavigation)
    return sourceNavigation;
  let destinationState = event.destination.getState();
  if (isRuntimeNavigation(destinationState))
    return { state: destinationState };
}
function getTraverseNavigationState(navigation, event) {
  let destinationState = event.destination.getState();
  if (isRuntimeNavigation(destinationState)) {
    return destinationState;
  }
  let matchingEntry = navigation.entries().find((entry) => entry.key === event.destination.key);
  if (matchingEntry) {
    let state = matchingEntry.getState();
    if (isRuntimeNavigation(state)) {
      return state;
    }
  }
  return void 0;
}
function getSourceElementNavigation(navigation, event, resolveFormNavigation) {
  let sourceEvent = event;
  let sourceElement = sourceEvent.sourceElement;
  if (!(sourceElement instanceof Element))
    return;
  let linkElement = sourceElement.closest("a, area");
  if (linkElement instanceof Element) {
    if (linkElement.hasAttribute("data-rmx-document"))
      return;
    if (linkElement.hasAttribute("download"))
      return;
    return {
      state: {
        target: linkElement.getAttribute("data-rmx-target") ?? void 0,
        src: linkElement.getAttribute("data-rmx-src") ?? event.destination.url,
        resetScroll: linkElement.getAttribute("data-rmx-reset-scroll") !== "false",
        $rmx: true
      },
      replaceHistory: getReplaceHistory(linkElement.getAttribute("data-rmx-history"), false)
    };
  }
  let formNavigation = resolveFormNavigation(event);
  if (!formNavigation || formNavigation.hasAttribute("data-rmx-document"))
    return;
  let replaceHistoryByDefault = formNavigation.getSubmission !== void 0 && event.destination.url === navigation.currentEntry?.url;
  return {
    state: {
      target: formNavigation.getAttribute("data-rmx-target") ?? void 0,
      src: formNavigation.getAttribute("data-rmx-src") ?? event.destination.url,
      resetScroll: formNavigation.getAttribute("data-rmx-reset-scroll") !== "false",
      $rmx: true
    },
    replaceHistory: getReplaceHistory(formNavigation.getAttribute("data-rmx-history"), replaceHistoryByDefault),
    getSubmission: formNavigation.getSubmission
  };
}
function getReplaceHistory(value, defaultValue) {
  if (value === "replace")
    return true;
  if (value === "push")
    return false;
  return defaultValue;
}

// node_modules/@remix-run/component/dist/runtime/run.js
var topFrame;
function getTopFrame() {
  if (!topFrame)
    throw new Error("app runtime not initialized");
  return topFrame.handle;
}
var namedFrames = new NamedFrameRegistry();
function getNamedFrame(name) {
  return namedFrames.get(name);
}
function getRequestBody(options) {
  let formData = options?.formData;
  let method = options?.method;
  if (!formData || !method || ["get", "head"].includes(method.toLowerCase()))
    return;
  let encType = options?.encType;
  if (encType === "text/plain") {
    let body2 = "";
    for (let [name, value] of formData) {
      name = normalizeLineBreaks(name);
      value = normalizeLineBreaks(typeof value === "string" ? value : value.name);
      body2 += `${name}=${value}\r
`;
    }
    return new Blob([body2], { type: "text/plain" });
  }
  if (encType !== "application/x-www-form-urlencoded")
    return formData;
  let body = new URLSearchParams();
  for (let [name, value] of formData) {
    body.append(name, typeof value === "string" ? value : value.name);
  }
  return body;
}
function normalizeLineBreaks(value) {
  return value.replace(/\r\n|\r|\n/g, "\r\n");
}
async function defaultResolveFrame(src, options) {
  let headers = new Headers({ Accept: "text/html", "X-Remix-Frame": "true" });
  if (options?.target != null)
    headers.set("X-Remix-Target", options.target);
  let response = await fetch(src, {
    body: getRequestBody(options),
    headers,
    method: options?.method,
    mode: "same-origin",
    signal: options?.signal
  });
  let isHtml = response.headers.get("Content-Type")?.toLowerCase().includes("text/html");
  if (response.status >= 500 || response.status >= 300 && !isHtml) {
    throw new Error(`Failed to resolve frame: ${response.status} ${response.statusText}`.trimEnd());
  }
  return response;
}
function run(init) {
  let styleManager = createStyleManager();
  let errorTarget = new TypedEventTarget();
  let scheduler = createScheduler(document, errorTarget, styleManager);
  let resolveFrame = init.resolveFrame ?? defaultResolveFrame;
  topFrame = createFrame(document, {
    src: document.location.href,
    errorTarget,
    loadModule: init.loadModule,
    resolveFrame,
    pendingClientEntries: /* @__PURE__ */ new Map(),
    scheduler,
    styleManager,
    data: {},
    moduleCache: /* @__PURE__ */ new Map(),
    moduleLoads: /* @__PURE__ */ new Map(),
    frameInstances: /* @__PURE__ */ new WeakMap(),
    namedFrames,
    processClientEntryPreloads: init.processClientEntryPreloads
  });
  let appController = new AbortController();
  let frames = {
    top: topFrame.handle,
    get(name) {
      return namedFrames.get(name);
    }
  };
  startNavigationListener(appController.signal);
  let readyPromise = topFrame.ready().catch((error) => {
    errorTarget.dispatchEvent(createComponentErrorEvent(error));
    throw error;
  });
  return Object.assign(errorTarget, {
    frames,
    ready: () => readyPromise,
    flush: () => topFrame.flush(),
    dispose: () => {
      appController.abort();
      topFrame.dispose();
      styleManager.dispose();
    }
  });
}

// app/actions/public/entry.ts
var app = run({
  async loadModule(moduleUrl, exportName) {
    const mod = await import(
      /* @vite-ignore */
      moduleUrl
    );
    const component = mod[exportName];
    if (typeof component !== "function") {
      throw new Error(`Unknown component: ${moduleUrl}#${exportName}`);
    }
    return component;
  }
});
await app.ready();
