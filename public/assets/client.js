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
function createComponent(config2) {
  return new ComponentRuntime(config2);
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
  constructor(config2) {
    this.#config = config2;
    this.frame = config2.frame;
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
  let cached2 = camelToKebabCache.get(str);
  if (cached2 === void 0) {
    cached2 = str.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    if (camelToKebabCache.size >= CAMEL_TO_KEBAB_CACHE_LIMIT) {
      let oldest = camelToKebabCache.keys().next();
      if (!oldest.done)
        camelToKebabCache.delete(oldest.value);
    }
    camelToKebabCache.set(str, cached2);
  }
  return cached2;
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
function isComplexSelector(key) {
  return key.startsWith("&") || key.startsWith("@") || key.startsWith(":") || key.startsWith("[") || key.startsWith(".");
}
function isKeyframesAtRule(key) {
  if (!key.startsWith("@"))
    return false;
  let lower = key.toLowerCase();
  return lower.startsWith("@keyframes") || lower.startsWith("@-webkit-keyframes") || lower.startsWith("@-moz-keyframes") || lower.startsWith("@-o-keyframes");
}
function hashStyle(obj) {
  let sortedEntries = Object.entries(obj).sort(([a], [b]) => a.localeCompare(b));
  let str = JSON.stringify(sortedEntries);
  let h1 = 2166136261;
  let h2 = 3421674724;
  for (let i = 0; i < str.length; i++) {
    let char = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ char, 16777619) >>> 0;
    h2 = Math.imul(h2 ^ char, 16777619) >>> 0;
  }
  return h1.toString(36) + h2.toString(36);
}
function styleToCss(styles, selector = "") {
  let baseDeclarations = [];
  let nestedBlocks = [];
  let atRules = [];
  let preludeAtRules = [];
  for (let [key, value] of Object.entries(styles)) {
    if (isComplexSelector(key)) {
      if (key.startsWith("@")) {
        let record3 = toRecord(value);
        if (!record3)
          continue;
        if (key.startsWith("@function")) {
          let body = atRuleBodyToCss(record3);
          if (body.trim().length > 0) {
            preludeAtRules.push(`${key} {
${indent(body, 2)}
}`);
          } else {
            preludeAtRules.push(`${key} {
}`);
          }
        } else if (isKeyframesAtRule(key)) {
          let body = keyframesBodyToCss(record3);
          if (body.trim().length > 0) {
            preludeAtRules.push(`${key} {
${indent(body, 2)}
}`);
          } else {
            preludeAtRules.push(`${key} {
}`);
          }
        } else {
          let inner = styleToCss(record3, selector);
          if (inner.trim().length > 0) {
            atRules.push(`${key} {
${indent(inner, 2)}
}`);
          } else {
            atRules.push(`${key} {
  ${selector} {
  }
}`);
          }
        }
        continue;
      }
      let record2 = toRecord(value);
      if (!record2)
        continue;
      let nestedContent = nestedStyleBodyToCss(record2, 4);
      if (nestedContent.trim().length > 0) {
        nestedBlocks.push(`  ${key} {
${nestedContent}
  }`);
      }
    } else {
      if (value != null) {
        let normalizedValue = normalizeCssValue(key, value);
        baseDeclarations.push(`  ${camelToKebab(key)}: ${normalizedValue};`);
      }
    }
  }
  let css2 = "";
  if (preludeAtRules.length > 0) {
    css2 += preludeAtRules.join("\n");
  }
  if (selector && (baseDeclarations.length > 0 || nestedBlocks.length > 0)) {
    css2 += (css2 ? "\n" : "") + `${selector} {
`;
    if (baseDeclarations.length > 0) {
      css2 += baseDeclarations.join("\n") + "\n";
    }
    if (nestedBlocks.length > 0) {
      css2 += nestedBlocks.join("\n") + "\n";
    }
    css2 += "}";
  }
  if (atRules.length > 0) {
    css2 += (css2 ? "\n" : "") + atRules.join("\n");
  }
  return css2;
}
function nestedStyleBodyToCss(styles, spaces) {
  let pad = " ".repeat(spaces);
  let declarations = [];
  let nestedBlocks = [];
  for (let [key, value] of Object.entries(styles)) {
    if (isComplexSelector(key)) {
      let record2 = toRecord(value);
      if (!record2)
        continue;
      let nestedContent = nestedStyleBodyToCss(record2, spaces + 2);
      if (nestedContent.trim().length > 0) {
        nestedBlocks.push(`${pad}${key} {
${nestedContent}
${pad}}`);
      }
    } else if (value != null) {
      let normalizedValue = normalizeCssValue(key, value);
      declarations.push(`${pad}${camelToKebab(key)}: ${normalizedValue};`);
    }
  }
  return [...declarations, ...nestedBlocks].join("\n");
}
function indent(text, spaces) {
  let pad = " ".repeat(spaces);
  return text.split("\n").map((line) => line.length ? pad + line : line).join("\n");
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function toRecord(value) {
  return isRecord(value) ? value : null;
}
function keyframesBodyToCss(frames) {
  let blocks = [];
  for (let [frameSelector, frameValue] of Object.entries(frames)) {
    if (!isRecord(frameValue)) {
      continue;
    }
    let declarations = [];
    for (let [prop, propValue] of Object.entries(frameValue)) {
      if (propValue == null)
        continue;
      if (isComplexSelector(prop))
        continue;
      let normalizedValue = normalizeCssValue(prop, propValue);
      declarations.push(`  ${camelToKebab(prop)}: ${normalizedValue};`);
    }
    if (declarations.length > 0) {
      blocks.push(`${frameSelector} {
${declarations.join("\n")}
}`);
    } else {
      blocks.push(`${frameSelector} {
}`);
    }
  }
  return blocks.join("\n");
}
function atRuleBodyToCss(styles) {
  let declarations = [];
  let nested = [];
  for (let [key, value] of Object.entries(styles)) {
    if (isComplexSelector(key)) {
      if (key.startsWith("@")) {
        let record2 = toRecord(value);
        if (!record2)
          continue;
        let inner = atRuleBodyToCss(record2);
        if (inner.trim().length > 0) {
          nested.push(`${key} {
${indent(inner, 2)}
}`);
        } else {
          nested.push(`${key} {
}`);
        }
      } else {
        continue;
      }
    } else {
      if (value != null) {
        let normalizedValue = normalizeCssValue(key, value);
        declarations.push(`  ${camelToKebab(key)}: ${normalizedValue};`);
      }
    }
  }
  let body = "";
  if (declarations.length > 0) {
    body += declarations.join("\n");
  }
  if (nested.length > 0) {
    body += (body ? "\n" : "") + nested.join("\n");
  }
  return body;
}
function processStyleClass(styleObj, styleCache) {
  if (Object.keys(styleObj).length === 0) {
    return { selector: "", css: "" };
  }
  let hash = hashStyle(styleObj);
  let selector = `rmxc-${hash}`;
  let cached2 = styleCache.get(hash);
  if (cached2) {
    return cached2;
  }
  let css2 = styleToCss(styleObj, `.${selector}`);
  let result = { selector, css: css2 };
  styleCache.set(hash, result);
  return result;
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
  let cached2 = cache.get(name);
  if (cached2 === void 0) {
    cached2 = computeAttributeName(name, isSvg);
    if (cache.size >= NORMALIZATION_CACHE_LIMIT) {
      let oldest = cache.keys().next();
      if (!oldest.done)
        cache.delete(oldest.value);
    }
    cache.set(name, cached2);
  }
  return cached2;
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
  let cached2 = kebabCaseCache.get(value);
  if (cached2 === void 0) {
    cached2 = value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
    if (kebabCaseCache.size >= NORMALIZATION_CACHE_LIMIT) {
      let oldest = kebabCaseCache.keys().next();
      if (!oldest.done)
        kebabCaseCache.delete(oldest.value);
    }
    kebabCaseCache.set(value, cached2);
  }
  return cached2;
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
function clientEntry(entryId, component) {
  if (!entryId) {
    throw new Error("clientEntry() requires an entry ID");
  }
  component.$entry = true;
  component.$entryId = entryId;
  return component;
}
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
function assertRemixNodes(values) {
  for (let value of values) {
    invariant(isRemixNode(value), "Invalid child node");
  }
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
function unsafeHTML(value) {
  let result = new UnsafeHTMLValue(value);
  Object.freeze(result);
  return result;
}
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
function renderMixinElement(element, props) {
  let { key, ...rest } = props ?? {};
  return jsx(element, rest, key);
}
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
function on(type, handler, captureBoolean) {
  return onMixin(type, handler, captureBoolean);
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
  let version2 = ++state.pendingRestoreVersion;
  queueMicrotask(() => {
    if (state.disposed)
      return;
    if (state.pendingRestoreVersion !== version2)
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
function diffVNodes(curr, next, domParent, vParent, context, anchor2, cursor) {
  if (curr === null) {
    return insert(next, domParent, vParent, context, anchor2, cursor);
  }
  if (isCommittedClientEntryNode(curr) && next.kind === "component" && isEntry(next.type)) {
    return diffClientEntryBoundary(curr, next, vParent, context);
  }
  if (componentStalenessCheck !== null && curr.kind === "component" && next.kind === "component" && componentStalenessCheck(curr.type) === true) {
    return replace(curr, next, domParent, vParent, context, anchor2);
  }
  if (curr.kind !== next.kind || curr.type !== next.type) {
    return replace(curr, next, domParent, vParent, context, anchor2);
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
      committed._children = diffChildren(curr._children, childInputs, domParent, committed, context, void 0, anchor2);
      return committed;
    }
    case "frame": {
      return diffFrame(curr, next, domParent, vParent, context, getSvgContext(vParent, next), anchor2);
    }
    case "component": {
      return diffComponent(curr, next, domParent, vParent, context, getSvgContext(vParent, next), anchor2, cursor);
    }
  }
}
function replace(curr, next, domParent, vParent, context, anchor2) {
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
  let replacementAnchor = findNextSiblingDomAnchor(curr) ?? anchor2;
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
function insert(node, domParent, vParent, context, anchor2, cursor) {
  let { frame, scheduler, styles } = context;
  let svg = getSvgContext(vParent, node);
  let hydrationNode = cursor?.current;
  if (hydrationNode && anchor2 && hydrationNode === anchor2) {
    hydrationNode = null;
  }
  hydrationNode = skipCommentsExceptBoundaryStart(hydrationNode ?? null, node.kind === "component" || node.kind === "fragment" || node.kind === "empty");
  if (hydrationNode && anchor2 && hydrationNode === anchor2) {
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
  let doInsert = anchor2 ? (dom) => domParent.insertBefore(dom, anchor2) : (dom) => domParent.appendChild(dom);
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
      children[i] = insert(childInputs[i], domParent, committed, context, anchor2, cursor);
    }
    committed._children = children;
    return committed;
  }
  if (node.kind === "component") {
    return diffComponent(null, node, domParent, vParent, context, svg, anchor2, cursor);
  }
  if (node.kind === "frame") {
    return insertFrame(node, domParent, vParent, context, svg, anchor2, cursor);
  }
  invariant(false, "Unexpected node type");
}
function diffFrame(curr, next, domParent, vParent, context, svg, anchor2) {
  let { frame } = context;
  let currSrc = getFrameSrc(curr);
  let nextSrc = getFrameSrc(next);
  let currName = getFrameName(curr);
  let nextName = getFrameName(next);
  if (currName !== nextName) {
    let replaceAnchor = curr._rangeEnd.nextSibling ?? anchor2;
    remove(curr, domParent, context);
    return insertFrame(next, domParent, vParent, context, svg, replaceAnchor);
  }
  if (currSrc !== nextSrc && !curr._state.resolved) {
    let replaceAnchor = curr._rangeEnd.nextSibling ?? anchor2;
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
function insertFrame(node, domParent, vParent, context, svg, anchor2, cursor) {
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
  let doInsert = anchor2 ? (dom) => domParent.insertBefore(dom, anchor2) : (dom) => domParent.appendChild(dom);
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
  let aborted2 = false;
  let onAbort = () => {
    aborted2 = true;
    void reader.cancel(signal.reason);
  };
  if (signal.aborted)
    onAbort();
  else
    signal.addEventListener("abort", onAbort, { once: true });
  return new ReadableStream({
    async pull(controller) {
      if (aborted2) {
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
function renderComponent(currContent, next, domParent, context, anchor2, cursor) {
  let { scheduler } = context;
  let handle = next._handle;
  if (handle.isRemoved()) {
    invariant("_content" in next, "Expected removed component to be committed");
    return next;
  }
  let [element, tasks] = handle.render(next.props);
  let content = diffVNodes(currContent, toVNode(element), domParent, next, context, anchor2, cursor);
  let committed = commitComponentNode(next, content);
  handle.setScheduleUpdate(scheduler, committed, domParent);
  scheduler.enqueueTasks(tasks);
  return committed;
}
function diffComponent(curr, next, domParent, vParent, context, svg, anchor2, cursor) {
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
    return renderComponent(null, mounting2, domParent, context, anchor2, cursor);
  }
  let mounting = beginComponentNode(next, vParent, svg, curr._handle, context);
  return renderComponent(curr._content, mounting, domParent, context, anchor2, cursor);
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
function diffChildren(curr, next, domParent, vParent, context, cursor, anchor2) {
  let hasKeys = hasKeyedChildren(next);
  let committed = next;
  if (curr === null) {
    if (hasKeys) {
      warnDuplicateKeys(next);
    }
    for (let i = 0; i < next.length; i++) {
      committed[i] = insert(next[i], domParent, vParent, context, anchor2, cursor);
    }
    return committed;
  }
  if (curr.length > 0 && next.length === 0 && anchor2 === void 0 && !parentUsesInnerHTML(vParent) && canBulkClearChildren(curr)) {
    for (let i = 0; i < curr.length; i++) {
      cleanupDescendants(curr[i], context);
    }
    domParent.textContent = "";
    return EMPTY_COMMITTED_CHILDREN;
  }
  if (!hasKeys) {
    for (let i = 0; i < next.length; i++) {
      let currentNode = i < curr.length ? curr[i] : null;
      committed[i] = diffVNodes(currentNode, next[i], domParent, vParent, context, anchor2, cursor);
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
  return patchKeyedChildren(curr, next, domParent, vParent, context, cursor, anchor2);
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
function patchKeyedChildren(curr, next, domParent, vParent, context, cursor, anchor2) {
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
    committed[index] = diffVNodes(oldNode, next[index], domParent, vParent, context, anchor2, cursor);
  }
  let committedChildren = committed;
  if (matchAnalysis.canSkipPlacement) {
    return committedChildren;
  }
  let stableIndexes = lisMatches(matches);
  let stableCursor = stableIndexes.length - 1;
  let placementAnchor = anchor2 ?? null;
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
function placeVNode(node, domParent, anchor2) {
  let firstDom = findFirstDomAnchor(node);
  if (!firstDom || firstDom.parentNode !== domParent)
    return;
  let lastDom = findLastDomAnchor(node);
  if (!lastDom)
    return;
  if (anchor2 && domRangeContainsNode(firstDom, lastDom, anchor2))
    return;
  if (firstDom === anchor2)
    return;
  moveDomRange(domParent, firstDom, lastDom, anchor2);
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
            let anchor2 = findNextSiblingDomAnchor(vnode) || void 0;
            try {
              renderComponent(curr, vnode, domParent, vnode._context, anchor2);
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
  let anchor2 = regionTailRef;
  for (let i = committed.length - 1; i >= 0; i--) {
    let unit = committed[i];
    let first = getSiblingUnitFirstNode(unit);
    let ref2 = anchor2?.parentNode === parent ? anchor2 : null;
    if (unit.kind === "node" && isPreservedDomElement(unit.node) && unit.node.parentNode === parent) {
      anchor2 = unit.node;
      continue;
    }
    placeSiblingUnitBefore(unit, parent, ref2);
    if (first.parentNode === parent)
      anchor2 = first;
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
function placeSiblingUnitBefore(unit, parent, ref2) {
  if (unit.kind === "node") {
    if (unit.node.parentNode !== parent || unit.node.nextSibling !== ref2) {
      parent.insertBefore(unit.node, ref2);
    }
    return;
  }
  let nodes = collectNodeRange(unit.start, unit.end);
  if (unit.start.parentNode === parent && unit.end.nextSibling === ref2)
    return;
  let fragment = unit.start.ownerDocument.createDocumentFragment();
  for (let node of nodes)
    fragment.appendChild(node);
  parent.insertBefore(fragment, ref2);
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
  return isRecord2(value) && Reflect.get(value, FRAME_RUNTIME) === true;
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
    let transition2 = startReloadTransition(options);
    void transition2.committed.catch(() => {
    });
    return await transition2.finished;
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
  let failure2;
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
      rejectReady?.(failure2);
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
          failure2 = error;
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
  let cached2 = context.moduleCache.get(key);
  if (cached2 && !parentHydration) {
    hydrateWithComponent(cached2);
    complete();
    return;
  }
  let component = cached2 ?? getOrStartModuleLoad(key, identity, marker.id, context);
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
  invariant(isRecord2(revivedProps), "Expected revived component props to be an object");
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
  if (!isRecord2(value))
    return value;
  let record2 = value;
  if (record2.$rmxFrame === true) {
    let props = reviveSerializedObject(record2.props);
    let key = reviveSerializedValue(record2.key);
    return jsx(Frame, props, key);
  }
  if (record2.$rmx === true && typeof record2.type === "string") {
    let props = reviveSerializedObject(record2.props);
    let key = reviveSerializedValue(record2.key);
    return jsx(record2.type, props, key);
  }
  let revived = {};
  for (let key in record2) {
    revived[key] = reviveSerializedValue(record2[key]);
  }
  return revived;
}
function reviveSerializedObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return {};
  let revived = reviveSerializedValue(value);
  if (!revived || typeof revived !== "object" || Array.isArray(revived))
    return {};
  return isRecord2(revived) ? revived : {};
}
function isRecord2(value) {
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
    let clone2 = fragment.cloneNode(true);
    invariant(isDocumentFragmentNode(clone2), "Expected cloned frame template fragment");
    listener(clone2);
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
function resyncWebKitScrollAfterNavigation(event, resetScroll, transition2) {
  let userAgent = navigator.userAgent;
  if (!userAgent.includes("AppleWebKit") || isChromiumUserAgent(userAgent))
    return;
  if (!resetScroll || event.navigationType !== "push" && event.navigationType !== "replace")
    return;
  if (new URL(event.destination.url).hash)
    return;
  void transition2.finished.then(() => {
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
    let transition2 = navigation.transition;
    if (!transition2)
      return scrollStyleWorkarounds?.remove();
    transitionBound = true;
    resyncWebKitScrollAfterNavigation(event, resetScroll, transition2);
    if (scrollStyleWorkarounds) {
      scheduleNavigationScrollCleanup(transition2, scrollStyleWorkarounds.remove, scrollStyleWorkarounds.cleanup);
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
function scheduleNavigationScrollCleanup(transition2, removeScrollStyles, cleanup) {
  function removeAfterSuccess() {
    if (cleanup === "finished")
      return removeScrollStyles();
    requestAnimationFrame(() => requestAnimationFrame(removeScrollStyles));
  }
  void transition2.finished.then(removeAfterSuccess, removeScrollStyles);
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

// node_modules/@remix-run/component/dist/runtime/create-element.js
function createElement2(type, props, ...children) {
  let nextProps = { ...props ?? {} };
  if (isMixinElementType(type)) {
    if (children.length > 0) {
      console.error(new Error("mixin elements must not receive children"));
    }
  } else {
    assertRemixNodes(children);
    nextProps.children = normalizeChildren(children);
  }
  if (nextProps.key != null) {
    let { key, ...rest } = nextProps;
    return jsx(type, rest, key);
  }
  return jsx(type, nextProps);
}
function isMixinElementType(type) {
  return typeof type === "function" && "__rmxMixinElementType" in type;
}

// node_modules/@remix-run/component/dist/runtime/mixins/ref-mixin.js
var ref = createMixin((handle) => {
  let controller;
  handle.addEventListener("insert", (event) => {
    controller = new AbortController();
    callback(event.node, controller.signal);
  });
  handle.addEventListener("remove", () => {
    controller?.abort(new DOMException("", "AbortError"));
    controller = void 0;
  });
  let callback = () => {
  };
  return (nextCallback) => {
    callback = nextCallback;
    return handle.element;
  };
});

// node_modules/@remix-run/component/dist/runtime/mixins/attrs-mixin.js
var attrsMixin = createMixin((handle) => (defaults, props) => {
  let nextProps = props;
  for (let key in defaults) {
    if (props[key] !== void 0)
      continue;
    if (nextProps === props)
      nextProps = { ...props };
    nextProps[key] = defaults[key];
  }
  return nextProps === props ? handle.element : createElement2(handle.element, nextProps);
});
function attrs(defaults) {
  return attrsMixin(defaults);
}

// node_modules/@remix-run/component/dist/style/css-mixin.js
var clientStyleCache = /* @__PURE__ */ new Map();
var css = createMixin((handle) => {
  let activeSelector = "";
  let activeGeneration = -1;
  let currentStyles = {};
  handle.addEventListener("remove", () => {
    if (!activeSelector)
      return;
    let runtime = handle.frame.$runtime;
    invariant(runtime, "css mixin requires frame runtime");
    let styleTarget = resolveStyleTarget(runtime);
    styleTarget.styleManager?.remove(activeSelector);
    activeSelector = "";
    activeGeneration = -1;
  });
  return (styles, props) => {
    currentStyles = styles;
    let runtime = handle.frame.$runtime;
    invariant(runtime, "css mixin requires frame runtime");
    let styleTarget = resolveStyleTarget(runtime);
    let { selector, css: cssText } = processStyleClass(currentStyles, styleTarget.styleCache);
    let styleGeneration = styleTarget.styleManager?.getGeneration?.() ?? 0;
    if (styleTarget.styleManager) {
      if (activeSelector && activeSelector !== selector) {
        styleTarget.styleManager.remove(activeSelector);
      }
      if (selector && (activeSelector !== selector || activeGeneration !== styleGeneration)) {
        styleTarget.styleManager.insert(selector, cssText);
      }
      activeSelector = selector;
      activeGeneration = selector ? styleGeneration : -1;
    }
    if (!selector) {
      return handle.element;
    }
    return renderMixinElement(handle.element, {
      ...props ?? {},
      className: props?.className ? `${props.className} ${selector}` : selector
    });
  };
});
function resolveStyleTarget(runtime) {
  return {
    styleCache: runtime.styleCache ?? clientStyleCache,
    styleManager: runtime.styleManager
  };
}

// app/ui/copy-button.tsx
var FADE_MS = 160;
var HOLD_MS = 1200;
var buttonStyle = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "0.375rem",
  padding: "0.375rem 0.75rem",
  border: "1px solid var(--color-border)",
  borderRadius: "0.375rem",
  background: "var(--color-bg-card)",
  color: "var(--color-primary)",
  font: "inherit",
  fontSize: "0.85rem",
  cursor: "pointer",
  "&:hover": { background: "var(--color-primary-soft)" }
});
var CopyButton = clientEntry(
  "/assets/client.js#CopyButton",
  function CopyButtonEntry(handle) {
    let state = "idle";
    return () => {
      const label = state === "copied" ? "\u30B3\u30D4\u30FC\u3057\u307E\u3057\u305F" : state === "failed" ? "\u30B3\u30D4\u30FC\u5931\u6557" : handle.props.label ?? "Markdown\u3092\u30B3\u30D4\u30FC";
      return /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          mix: [
            buttonStyle,
            on("click", async () => {
              try {
                await navigator.clipboard.writeText(handle.props.text);
                state = "copied";
              } catch {
                state = "failed";
              }
              await handle.update();
              await new Promise((resolve) => setTimeout(resolve, HOLD_MS));
              state = "idle";
              await handle.update();
            })
          ],
          style: { transition: `opacity ${FADE_MS}ms ease` },
          children: label
        }
      );
    };
  }
);

// app/lib/dateTime.ts
var systemClock = {
  nowEpochMilliseconds: () => Date.now()
};

// app/features/markdown/questionToMarkdown.ts
function tableToMarkdown(columns, rows) {
  const header = `| ${columns.map((c) => c.label).join(" | ")} |`;
  const separator = `| ${columns.map(() => "---").join(" | ")} |`;
  const dataRows = rows.map((row) => {
    const cells = columns.map((c) => String(row[c.key] ?? ""));
    return `| ${cells.join(" | ")} |`;
  });
  return [header, separator].concat(dataRows).join("\n");
}
function figureDataToMarkdown(figureData) {
  switch (figureData.type) {
    case "truthTable":
    case "dataTable":
      return tableToMarkdown(figureData.columns, figureData.rows);
    case "huffmanTable": {
      const { characters, probabilities } = figureData.data;
      return ["| \u6587\u5B57 | \u78BA\u7387 |", "| --- | --- |"].concat(characters.map((c, i) => `| ${c} | ${probabilities[i]} |`)).join("\n");
    }
    case "linkedListTable":
      return ["| \u30A2\u30C9\u30EC\u30B9 | \u30C7\u30FC\u30BF | \u30DD\u30A4\u30F3\u30BF |", "| --- | --- | --- |"].concat(figureData.entries.map((e) => `| ${e.address} | ${e.data} | ${e.pointer} |`)).join("\n");
    case "normalDistributionTable":
      return ["| u | \u78BA\u7387 |", "| --- | --- |"].concat(figureData.entries.map((e) => `| ${e.u} | ${e.probability} |`)).join("\n");
    case "parityCheck":
      return figureData.data.map((row) => `| ${row.join(" | ")} |`).join("\n");
    case "stateDiagram": {
      const { nodes, transitions } = figureData;
      const nodeLines = nodes.map((node) => {
        const markers = [
          ...node.isInitial ? ["\u521D\u671F\u72B6\u614B"] : [],
          ...node.isAccepting ? ["\u53D7\u7406\u72B6\u614B"] : []
        ];
        const markerStr = markers.length > 0 ? ` (${markers.join(", ")})` : "";
        return `- ${node.label}${markerStr}`;
      });
      const nodeById = new Map(nodes.map((n) => [n.id, n]));
      const transLines = transitions.map((t) => {
        const fromNode = nodeById.get(t.from);
        const toNode = nodeById.get(t.to);
        return `- ${fromNode?.label ?? t.from} --[${t.label}]--> ${toNode?.label ?? t.to}`;
      });
      return ["**\u72B6\u614B\u9077\u79FB\u56F3**", "", "\u72B6\u614B:"].concat(nodeLines, ["", "\u9077\u79FB:"], transLines).join("\n");
    }
    case "binaryTree": {
      const collectNodes = (node, depth) => {
        if (!node) {
          return [];
        }
        const indent2 = "  ".repeat(depth);
        return [indent2.concat(`- ${node.value}`)].concat(
          collectNodes(node.left, depth + 1),
          collectNodes(node.right, depth + 1)
        );
      };
      return ["**\u4E8C\u5206\u6728**", ""].concat(collectNodes(figureData.root, 0)).join("\n");
    }
    case "logicCircuit": {
      const { inputs, outputs, gates } = figureData;
      return [
        "**\u8AD6\u7406\u56DE\u8DEF**",
        "",
        `\u5165\u529B: ${inputs.map((i) => i.label).join(", ")}`,
        `\u51FA\u529B: ${outputs.map((o) => o.label).join(", ")}`,
        `\u30B2\u30FC\u30C8: ${gates.map((g) => `${g.id}(${g.type})`).join(", ")}`
      ].join("\n");
    }
    case "flowchart": {
      const { nodes, edges } = figureData;
      const nodeLines = nodes.map((node) => `- [${node.type}] ${node.label}`);
      const nodeById = new Map(nodes.map((n) => [n.id, n]));
      const edgeLines = edges.map((edge) => {
        const fromNode = nodeById.get(edge.from);
        const toNode = nodeById.get(edge.to);
        const label = edge.label ? ` (${edge.label})` : "";
        return `- ${fromNode?.label ?? edge.from} --> ${toNode?.label ?? edge.to}${label}`;
      });
      return ["**\u30D5\u30ED\u30FC\u30C1\u30E3\u30FC\u30C8**", "", "\u30CE\u30FC\u30C9:"].concat(nodeLines, ["", "\u30D5\u30ED\u30FC:"], edgeLines).join("\n");
    }
    default:
      return "";
  }
}
function buildFigureSection(question, sectionHeading) {
  if (question.figureData) {
    return [`${sectionHeading} \u56F3`, "", figureDataToMarkdown(question.figureData), ""];
  }
  if (question.figureDescription) {
    return [`> **\u56F3**: ${question.figureDescription}`, ""];
  }
  return [];
}
function questionToMarkdown(question, {
  includeSolution = true,
  headingLevel = 2
} = {}) {
  const heading = "#".repeat(headingLevel);
  const sectionHeading = `${heading}#`;
  const base = [`${heading} \u554F\u984C ${question.number}`, "", question.text, ""];
  const figure = buildFigureSection(question, sectionHeading);
  const options = question.options && question.options.length > 0 ? [`${sectionHeading} \u9078\u629E\u80A2`].concat(
    question.options.map(
      (option) => `- **${option.label}**: ${option.value || "(\u672A\u5165\u529B)"}`
    )
  ).concat("") : [];
  const answer = includeSolution ? [`${sectionHeading} \u89E3\u7B54`, question.answer, ""] : [];
  const explanation = includeSolution && question.explanation ? [`${sectionHeading} \u89E3\u8AAC`, question.explanation] : [];
  return base.concat(figure, options, answer, explanation).join("\n").trim();
}

// app/lib/questionOrder.ts
function sortByQuestionId(values) {
  return values.toSorted((left, right) => left.questionId.localeCompare(right.questionId));
}

// app/lib/sort.ts
function sortNewestFirst(values) {
  return values.toSorted((left, right) => right.updatedAt - left.updatedAt);
}

// app/features/challenge/model.ts
var MAX_REASONABLE_TIMER_DELTA_MS = 24 * 60 * 60 * 1e3;
function calculateElapsedDelta(runtime, now) {
  if (!runtime.running || runtime.lastSample === null) {
    return 0;
  }
  const delta = now - runtime.lastSample;
  if (!Number.isFinite(delta) || delta < 0 || delta > MAX_REASONABLE_TIMER_DELTA_MS) {
    return 0;
  }
  return delta;
}
function createInitialChallengeState(input) {
  const maxIndex = Math.max(input.questionIds.length - 1, 0);
  return {
    version: 1,
    challengeId: input.challengeId,
    scopeKey: input.scopeKey,
    examId: input.examId,
    mode: input.mode,
    questionIds: [...input.questionIds],
    createdAt: input.createdAt,
    updatedAt: null,
    currentIndex: Math.min(Math.max(input.initialIndex ?? 0, 0), maxIndex),
    revealedQuestionIds: /* @__PURE__ */ new Set(),
    judgments: {},
    answerCreatedAt: {},
    questionElapsedMs: {},
    status: "active"
  };
}
function revealQuestion(state, action) {
  if (!state.questionIds.includes(action.questionId) || state.revealedQuestionIds.has(action.questionId)) {
    return state;
  }
  return {
    ...state,
    revealedQuestionIds: /* @__PURE__ */ new Set([...state.revealedQuestionIds, action.questionId])
  };
}
function judgeQuestion(state, action) {
  if (!state.questionIds.includes(action.questionId)) {
    return state;
  }
  if (state.revealedQuestionIds.has(action.questionId) === false) {
    return state;
  }
  if (state.judgments[action.questionId]) {
    return state;
  }
  return {
    ...state,
    judgments: { ...state.judgments, [action.questionId]: action.judgment },
    answerCreatedAt: {
      ...state.answerCreatedAt,
      [action.questionId]: action.answerCreatedAt
    }
  };
}
function applyElapsed(state, action) {
  if (!state.questionIds.includes(action.questionId)) {
    return state;
  }
  if (!Number.isFinite(action.deltaMs) || action.deltaMs <= 0) {
    return state;
  }
  const current = state.questionElapsedMs[action.questionId] ?? 0;
  return {
    ...state,
    questionElapsedMs: {
      ...state.questionElapsedMs,
      [action.questionId]: current + action.deltaMs
    }
  };
}
function moveTo(state, action) {
  if (!Number.isInteger(action.index)) {
    return state;
  }
  if (action.index < 0 || action.index >= state.questionIds.length) {
    return state;
  }
  if (action.index === state.currentIndex) {
    return state;
  }
  return { ...state, currentIndex: action.index };
}
function completeChallenge(state, action) {
  return state.status === "active" && isChallengeComplete(state) ? { ...state, status: "completed", updatedAt: action.updatedAt } : state;
}
function challengeReducer(state, action) {
  if (state.status !== "active") {
    return state;
  }
  switch (action.type) {
    case "REVEAL_QUESTION":
      return revealQuestion(state, action);
    case "JUDGE_QUESTION":
      return judgeQuestion(state, action);
    case "APPLY_ELAPSED":
      return applyElapsed(state, action);
    case "MOVE_TO":
      return moveTo(state, action);
    case "COMPLETE":
      return completeChallenge(state, action);
    case "MARK_INCOMPLETE":
      return state.status === "active" ? { ...state, status: "incomplete" } : state;
    default:
      action;
      return state;
  }
}
function applyElapsedDelta(state, questionId, deltaMs) {
  return challengeReducer(state, { type: "APPLY_ELAPSED", questionId, deltaMs });
}
function isChallengeComplete(state) {
  return state.questionIds.length > 0 && state.questionIds.every(
    (id) => state.judgments[id] !== void 0 && state.answerCreatedAt[id] !== void 0
  );
}
function createChallengeSnapshot(state) {
  const snapshot = {
    version: 1,
    challengeId: state.challengeId,
    scopeKey: state.scopeKey,
    examId: state.examId,
    mode: state.mode,
    questionIds: [...state.questionIds],
    createdAt: state.createdAt,
    currentIndex: state.currentIndex,
    revealedQuestionIds: [...state.revealedQuestionIds],
    judgments: { ...state.judgments },
    answerCreatedAt: { ...state.answerCreatedAt },
    questionElapsedMs: { ...state.questionElapsedMs }
  };
  return state.status === "completed" ? { ...snapshot, status: "completed", updatedAt: state.updatedAt } : { ...snapshot, status: state.status, updatedAt: null };
}
function restoreChallengeState(snapshot) {
  return {
    ...snapshot,
    questionIds: [...snapshot.questionIds],
    revealedQuestionIds: new Set(snapshot.revealedQuestionIds),
    judgments: { ...snapshot.judgments },
    answerCreatedAt: { ...snapshot.answerCreatedAt },
    questionElapsedMs: { ...snapshot.questionElapsedMs }
  };
}
function toCompletedChallengePayload(state, updatedAt) {
  if (!isChallengeComplete(state)) {
    return null;
  }
  const answers = state.questionIds.flatMap((questionId) => {
    const judgment = state.judgments[questionId];
    const createdAt = state.answerCreatedAt[questionId];
    if (judgment === void 0 || createdAt === void 0) {
      return [];
    }
    return [
      {
        questionId,
        elapsedMs: Math.max(0, Math.round(state.questionElapsedMs[questionId] ?? 0)),
        judgment,
        createdAt,
        updatedAt
      }
    ];
  });
  if (answers.length !== state.questionIds.length) {
    return null;
  }
  return {
    challengeId: state.challengeId,
    examId: state.examId,
    createdAt: state.createdAt,
    updatedAt,
    answers
  };
}
function formatDuration(elapsedMs) {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1e3));
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return hours > 0 ? `${hours}:${String(remainingMinutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}` : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
function formatAccuracy(accuracy) {
  return accuracy === null ? "\u2014" : `${Math.round(accuracy * 100)}%`;
}
function countJudgments(answers) {
  const correctCount = answers.filter((answer) => answer.judgment === "correct").length;
  return { correctCount, incorrectCount: answers.length - correctCount };
}
function summarizeChallenge(challenge) {
  const { correctCount, incorrectCount } = countJudgments(challenge.answers);
  const judgedCount = correctCount + incorrectCount;
  return {
    challengeCount: 1,
    judgedCount,
    correctCount,
    incorrectCount,
    accuracy: judgedCount === 0 ? null : correctCount / judgedCount,
    totalElapsedMs: challenge.answers.reduce((total, answer) => total + answer.elapsedMs, 0)
  };
}
function aggregateChallengeResults(completed) {
  const answers = completed.flatMap((challenge) => challenge.answers);
  const { correctCount, incorrectCount } = countJudgments(answers);
  const judgedCount = correctCount + incorrectCount;
  const byQuestion = Object.fromEntries(
    Array.from(
      Map.groupBy(answers, (answer) => answer.questionId),
      ([questionId, questionAnswers]) => {
        const questionJudgments = countJudgments(questionAnswers);
        const questionJudgedCount = questionJudgments.correctCount + questionJudgments.incorrectCount;
        const totalElapsedMs = questionAnswers.reduce(
          (total, answer) => total + answer.elapsedMs,
          0
        );
        return [
          questionId,
          {
            questionId,
            challengeCount: questionAnswers.length,
            judgedCount: questionJudgedCount,
            correctCount: questionJudgments.correctCount,
            incorrectCount: questionJudgments.incorrectCount,
            totalElapsedMs,
            averageElapsedMs: totalElapsedMs / questionJudgedCount
          }
        ];
      }
    )
  );
  return {
    challengeCount: completed.length,
    judgedCount,
    correctCount,
    incorrectCount,
    accuracy: judgedCount === 0 ? null : correctCount / judgedCount,
    totalElapsedMs: answers.reduce((total, answer) => total + answer.elapsedMs, 0),
    byQuestion
  };
}
function canonicalChallenge(challenge) {
  return {
    ...challenge,
    answers: sortByQuestionId(challenge.answers)
  };
}
function mergeCompletedChallenges(local, remote) {
  const grouped = Map.groupBy(
    [...local, ...remote].map(canonicalChallenge),
    (challenge) => challenge.challengeId
  );
  const merged = Array.from(
    grouped.values(),
    ([first, ...duplicates]) => duplicates.reduce(
      (current, candidate) => JSON.stringify(current) === JSON.stringify(candidate) ? candidate : current,
      first
    )
  );
  return sortNewestFirst(merged);
}
function isCompletedChallengePayload(value) {
  if (!value || typeof value !== "object") {
    return false;
  }
  const challenge = value;
  return typeof challenge.challengeId === "string" && typeof challenge.examId === "string" && typeof challenge.createdAt === "number" && typeof challenge.updatedAt === "number" && challenge.createdAt <= challenge.updatedAt && Array.isArray(challenge.answers) && challenge.answers.every((answer) => {
    if (!answer || typeof answer !== "object") {
      return false;
    }
    const candidate = answer;
    return typeof candidate.questionId === "string" && typeof candidate.elapsedMs === "number" && candidate.elapsedMs >= 0 && (candidate.judgment === "correct" || candidate.judgment === "incorrect") && typeof candidate.createdAt === "number" && typeof candidate.updatedAt === "number" && candidate.createdAt <= candidate.updatedAt && candidate.updatedAt === challenge.updatedAt;
  });
}

// app/lib/guards.ts
function isRecord3(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// node_modules/zod/v4/core/util.js
function jsonStringifyReplacer(_, value) {
  if (typeof value === "bigint")
    return value.toString();
  return value;
}
var Cached = class {
  constructor(getter) {
    this._getter = getter;
    this._value = void 0;
  }
  get value() {
    const getter = this._getter;
    if (getter !== void 0) {
      this._value = getter();
      this._getter = void 0;
    }
    return this._value;
  }
};
function cached(getter) {
  return new Cached(getter);
}
function nullish(input) {
  return input === null || input === void 0;
}
function cleanRegex(source) {
  const start = source.startsWith("^") ? 1 : 0;
  const end = source.endsWith("$") ? source.length - 1 : source.length;
  return source.slice(start, end);
}
function assignProp(target, prop, value) {
  Object.defineProperty(target, prop, {
    value,
    writable: true,
    enumerable: true,
    configurable: true
  });
}
var captureStackTrace = "captureStackTrace" in Error ? Error.captureStackTrace : (..._args) => {
};
function isObject(data) {
  return typeof data === "object" && data !== null && !Array.isArray(data);
}
function isPlainObject(o) {
  if (isObject(o) === false)
    return false;
  const ctor = o.constructor;
  if (ctor === void 0)
    return true;
  if (typeof ctor !== "function")
    return true;
  const prot = ctor.prototype;
  if (isObject(prot) === false)
    return false;
  if (Object.prototype.hasOwnProperty.call(prot, "isPrototypeOf") === false) {
    return false;
  }
  return true;
}
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function clone(inst, def, params) {
  const cl = new inst._zod.constr(def ?? inst._zod.def);
  if (!def || params?.parent)
    cl._zod.parent = inst;
  return cl;
}
function normalizeParams(_params) {
  const params = _params;
  if (!params)
    return {};
  if (typeof params === "string")
    return { error: () => params };
  if (params?.message !== void 0) {
    if (params?.error !== void 0)
      throw new Error("Cannot specify both `message` and `error` params");
    params.error = params.message;
  }
  delete params.message;
  if (typeof params.error === "string")
    return { ...params, error: () => params.error };
  return params;
}
function optionalKeys(shape) {
  return Object.keys(shape).filter((k) => {
    return shape[k]._zod.optin !== void 0 && shape[k]._zod.optout === "optional";
  });
}
var NUMBER_FORMAT_RANGES = /* @__PURE__ */ (() => ({
  safeint: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
  int32: [-2147483648, 2147483647],
  uint32: [0, 4294967295],
  float32: [-34028234663852886e22, 34028234663852886e22],
  float64: [-Number.MAX_VALUE, Number.MAX_VALUE]
}))();
function aborted(x, startIndex = 0) {
  if (x.aborted === true)
    return true;
  for (let i = startIndex; i < x.issues.length; i++) {
    if (x.issues[i]?.continue !== true) {
      return true;
    }
  }
  return false;
}
function explicitlyAborted(x, startIndex = 0) {
  if (x.aborted === true)
    return true;
  for (let i = startIndex; i < x.issues.length; i++) {
    if (x.issues[i]?.continue === false) {
      return true;
    }
  }
  return false;
}
function prefixIssues(path, issues) {
  return issues.map((iss) => {
    var _a2;
    (_a2 = iss).path ?? (_a2.path = []);
    iss.path.unshift(path);
    return iss;
  });
}
function unwrapMessage(message) {
  return typeof message === "string" ? message : message?.message;
}
function attachSchema(issues, start, inst) {
  var _a2;
  for (let i = start; i < issues.length; i++) {
    (_a2 = issues[i]).schema ?? (_a2.schema = inst);
  }
}
function finalizeIssue(iss, ctx, config2) {
  var _a2;
  const traits = iss.inst?._zod?.traits;
  if (traits?.has("$ZodType")) {
    if (traits.has("$ZodCheck"))
      (_a2 = iss).schema ?? (_a2.schema = iss.inst);
    else
      iss.schema = iss.inst;
  }
  const schemaError = iss.schema !== iss.inst ? iss.schema?._zod.def?.error : void 0;
  const message = iss.message ? iss.message : unwrapMessage(iss.inst?._zod.def?.error?.(iss)) ?? unwrapMessage(schemaError?.(iss)) ?? unwrapMessage(ctx?.error?.(iss)) ?? unwrapMessage(config2.customError?.(iss)) ?? unwrapMessage(config2.localeError?.(iss)) ?? "Invalid input";
  const full = {};
  for (const k of Object.keys(iss)) {
    if (k === "inst" || k === "schema" || k === "continue" || k === "input" || k === "__proto__")
      continue;
    full[k] = iss[k];
  }
  full.path ?? (full.path = []);
  full.message = message;
  if (ctx?.reportInput) {
    full.input = iss.input;
  }
  return full;
}
var highSurrogate = /[\uD800-\uDBFF]/;
function codePointLength(str) {
  const units = str.length;
  if (!highSurrogate.test(str))
    return units;
  let count = units;
  for (let i = 0; i < units - 1; i++) {
    if ((str.charCodeAt(i) & 64512) === 55296 && (str.charCodeAt(i + 1) & 64512) === 56320) {
      count--;
      i++;
    }
  }
  return count;
}
function getLengthableOrigin(input) {
  if (Array.isArray(input))
    return "array";
  if (typeof input === "string")
    return "string";
  return "unknown";
}
function issue(...args) {
  const [iss, input, inst] = args;
  if (typeof iss === "string") {
    return {
      message: iss,
      code: "custom",
      input,
      inst
    };
  }
  return { ...iss };
}
function members(proto, table) {
  for (const key in table) {
    const desc = Object.getOwnPropertyDescriptor(table, key);
    if (desc.get)
      Object.defineProperty(proto, key, { ...desc, enumerable: false });
    else
      defineBound(proto, key, desc.value);
  }
}
function own(inst, key, value, enumerable = true) {
  Object.defineProperty(inst, key, { configurable: true, writable: true, enumerable, value });
  return value;
}
function hide(inst, key, value) {
  return own(inst, key, value, false);
}
function defineBound(proto, key, fn) {
  Object.defineProperty(proto, key, {
    configurable: true,
    get() {
      return this == null ? fn : own(this, key, fn.bind(this));
    },
    set(value) {
      own(this, key, value);
    }
  });
}
function claim(inst, sentinel) {
  const proto = Object.getPrototypeOf(inst);
  return sentinel in proto ? void 0 : proto;
}
var installing;
var broke = false;
var breaker = {
  configurable: true,
  get() {
    broke = true;
    return void 0;
  }
};
function defineLazyInternal(inst, key, compute) {
  const proto = Object.getPrototypeOf(inst._zod);
  if (key in proto && installing !== inst._zod) {
    installing = void 0;
    return;
  }
  installing = inst._zod;
  Object.defineProperty(proto, key, {
    configurable: true,
    get() {
      Object.defineProperty(this, key, breaker);
      const outer = broke;
      broke = false;
      try {
        const value = compute(this);
        if (broke)
          delete this[key];
        else
          Object.defineProperty(this, key, { configurable: true, writable: true, value });
        broke = broke || outer;
        return value;
      } catch (err2) {
        delete this[key];
        broke = broke || outer;
        throw err2;
      }
    },
    set(value) {
      Object.defineProperty(this, key, { configurable: true, writable: true, value });
    }
  });
}
function installLazyProp(inst, key, make, enumerable) {
  const proto = claim(inst, key);
  if (!proto)
    return;
  Object.defineProperty(proto, key, {
    configurable: true,
    get() {
      const desc = { configurable: true, writable: true, enumerable, value: void 0 };
      Object.defineProperty(this, key, desc);
      desc.value = make(this);
      Object.defineProperty(this, key, desc);
      return desc.value;
    },
    set(value) {
      Object.defineProperty(this, key, { configurable: true, writable: true, enumerable, value });
    }
  });
}

// node_modules/zod/v4/core/core.js
var _a;
var _zodDesc = { value: void 0, enumerable: false };
var _E = "captureStackTrace" in Error ? Error : null;
function newError(Definition) {
  const E = _E;
  if (E) {
    const saved = E.stackTraceLimit;
    if (typeof saved === "number") {
      try {
        E.stackTraceLimit = 0;
      } catch {
        _E = null;
        return new Definition();
      }
      try {
        return new Definition();
      } finally {
        E.stackTraceLimit = saved;
      }
    }
  }
  return new Definition();
}
// @__NO_SIDE_EFFECTS__
function $constructor(name, initializer2, proto, params) {
  const zodProto = {};
  function Internals(def) {
    this.def = def;
    this.constr = _;
    this.traits = /* @__PURE__ */ new Set();
  }
  Internals.prototype = zodProto;
  const protoMembers = proto;
  const initialized = protoMembers && /* @__PURE__ */ new WeakSet();
  function init(inst, def) {
    if (!inst._zod) {
      _zodDesc.value = new Internals(def);
      try {
        Object.defineProperty(inst, "_zod", _zodDesc);
      } finally {
        _zodDesc.value = void 0;
      }
    } else if (inst._zod.traits.has(name)) {
      return;
    }
    inst._zod.traits.add(name);
    initializer2(inst, def);
    if (initialized) {
      const own2 = Object.getPrototypeOf(inst);
      const ctorProto = inst._zod.constr.prototype;
      let up = own2;
      while (up && up !== ctorProto)
        up = Object.getPrototypeOf(up);
      const target = up ?? own2;
      if (!initialized.has(target)) {
        initialized.add(target);
        members(target, protoMembers);
      }
    }
    const proto2 = _.prototype;
    for (const k in proto2) {
      if (!Object.prototype.hasOwnProperty.call(proto2, k))
        continue;
      if (!(k in inst)) {
        inst[k] = proto2[k].bind(inst);
      }
    }
  }
  const Parent = params?.Parent ?? Object;
  class Definition extends Parent {
  }
  Object.defineProperty(Definition, "name", { value: name });
  function _(def) {
    const inst = params?.Parent ? newError(Definition) : this;
    init(inst, def);
    const deferred = inst._zod.deferred;
    if (deferred) {
      for (const fn of deferred) {
        fn();
      }
      inst._zod.deferred = void 0;
    }
    const pp = globalThis.__zod_globalConfig?.postProcessor;
    if (pp)
      pp(inst);
    return inst;
  }
  Object.defineProperty(_, "init", { value: init });
  Object.defineProperty(_, Symbol.hasInstance, {
    value: (inst) => {
      if (params?.Parent && inst instanceof params.Parent)
        return true;
      return inst?._zod?.traits?.has(name);
    }
  });
  Object.defineProperty(_, "name", { value: name });
  return _;
}
var $ZodAsyncError = class extends Error {
  constructor() {
    super(`Encountered Promise during synchronous parse. Use .parseAsync() instead.`);
  }
};
(_a = globalThis).__zod_globalConfig ?? (_a.__zod_globalConfig = {});
var globalConfig = globalThis.__zod_globalConfig;
function config(newConfig) {
  if (newConfig)
    Object.assign(globalConfig, newConfig);
  return globalConfig;
}

// node_modules/zod/v4/core/errors.js
function _getMessage() {
  const internals = this._zod;
  internals.message ?? (internals.message = JSON.stringify(internals.def, jsonStringifyReplacer, 2));
  return internals.message;
}
function _setMessage(value) {
  this._zod.message = value;
}
var _messageDesc = {
  get: _getMessage,
  set: _setMessage,
  enumerable: true,
  configurable: true
};
var _issuesDesc = { value: void 0, enumerable: false };
var _installedToString = /* @__PURE__ */ new WeakSet([Object.prototype, Error.prototype]);
var initializer = (inst, def) => {
  inst.name = "$ZodError";
  _issuesDesc.value = def;
  Object.defineProperty(inst, "issues", _issuesDesc);
  _issuesDesc.value = void 0;
  Object.defineProperty(inst, "message", _messageDesc);
  const proto = Object.getPrototypeOf(inst);
  if (!_installedToString.has(proto)) {
    _installedToString.add(proto);
    Object.defineProperty(proto, "toString", {
      configurable: true,
      enumerable: false,
      get() {
        const value = () => this.message;
        Object.defineProperty(this, "toString", { value, configurable: true, writable: true });
        return value;
      },
      set(value) {
        Object.defineProperty(this, "toString", { value, configurable: true, writable: true });
      }
    });
  }
};
var $ZodError = $constructor("$ZodError", initializer);
var $ZodRealError = $constructor("$ZodError", initializer, void 0, {
  Parent: Error
});

// node_modules/zod/v4/core/parse.js
var _parse = (_Err) => {
  const fn = (schema, value, _ctx, _params) => {
    const ctx = _ctx ? { ..._ctx, async: false } : { async: false };
    const result = schema._zod.run({ value, issues: [] }, ctx);
    if (result instanceof Promise) {
      throw new $ZodAsyncError();
    }
    if (result.issues.length) {
      const e = new (_params?.Err ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
      captureStackTrace(e, _params?.callee ?? fn);
      throw e;
    }
    return result.value;
  };
  return fn;
};
var parse = /* @__PURE__ */ _parse($ZodRealError);
var _parseAsync = (_Err) => {
  const fn = async (schema, value, _ctx, params) => {
    const ctx = _ctx ? { ..._ctx, async: true } : { async: true };
    let result = schema._zod.run({ value, issues: [] }, ctx);
    if (result instanceof Promise)
      result = await result;
    if (result.issues.length) {
      const e = new (params?.Err ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
      captureStackTrace(e, params?.callee ?? fn);
      throw e;
    }
    return result.value;
  };
  return fn;
};
var parseAsync = /* @__PURE__ */ _parseAsync($ZodRealError);
var _safeParse = (_Err) => (schema, value, _ctx) => {
  const ctx = _ctx ? { ..._ctx, async: false } : { async: false };
  const result = schema._zod.run({ value, issues: [] }, ctx);
  if (result instanceof Promise) {
    throw new $ZodAsyncError();
  }
  return result.issues.length ? failure(_Err, result.issues, ctx) : { success: true, data: result.value };
};
var safeParse = /* @__PURE__ */ _safeParse($ZodRealError);
function failure(Err2, issues, ctx) {
  let error;
  return {
    success: false,
    get error() {
      if (!error) {
        error = new Err2(issues.map((iss) => finalizeIssue(iss, ctx, config())));
        issues = void 0;
        ctx = void 0;
      }
      return error;
    },
    set error(e) {
      error = e;
      issues = void 0;
      ctx = void 0;
    }
  };
}
var _safeParseAsync = (_Err) => async (schema, value, _ctx) => {
  const ctx = _ctx ? { ..._ctx, async: true } : { async: true };
  let result = schema._zod.run({ value, issues: [] }, ctx);
  if (result instanceof Promise)
    result = await result;
  return result.issues.length ? failure(_Err, result.issues, ctx) : { success: true, data: result.value };
};
var safeParseAsync = /* @__PURE__ */ _safeParseAsync($ZodRealError);

// node_modules/zod/v4/core/regexes.js
var anyString = /^[\s\S]{0,}$/;
var number = /^-?\d+(?:\.\d+)?$/;

// node_modules/zod/v4/core/checks.js
var $ZodCheck = /* @__PURE__ */ $constructor("$ZodCheck", (inst, def) => {
  var _a2;
  inst._zod ?? (inst._zod = {});
  inst._zod.def = def;
  (_a2 = inst._zod).onattach ?? (_a2.onattach = []);
});
var _whenHasLength = (payload) => {
  const val = payload.value;
  return !nullish(val) && val.length !== void 0;
};
var numericOriginMap = {
  number: "number",
  bigint: "bigint",
  object: "date"
};
var $ZodCheckGreaterThan = /* @__PURE__ */ $constructor("$ZodCheckGreaterThan", (inst, def) => {
  $ZodCheck.init(inst, def);
  const origin = numericOriginMap[typeof def.value];
  inst._zod.check = (payload) => {
    if (def.inclusive ? payload.value >= def.value : payload.value > def.value) {
      return;
    }
    payload.issues.push({
      origin: numericOriginMap[typeof payload.value] ?? origin,
      code: "too_small",
      minimum: typeof def.value === "object" ? def.value.getTime() : def.value,
      input: payload.value,
      inclusive: def.inclusive,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckNumberFormat = /* @__PURE__ */ $constructor("$ZodCheckNumberFormat", (inst, def) => {
  $ZodCheck.init(inst, def);
  def.format = def.format || "float64";
  const isInt = def.format?.includes("int");
  const origin = isInt ? "int" : "number";
  const [minimum, maximum] = NUMBER_FORMAT_RANGES[def.format];
  inst._zod.check = (payload) => {
    const input = payload.value;
    if (isInt) {
      if (!Number.isInteger(input)) {
        payload.issues.push({
          expected: origin,
          format: def.format,
          code: "invalid_type",
          continue: false,
          input,
          inst
        });
        return;
      }
      if (!Number.isSafeInteger(input)) {
        if (input > 0) {
          payload.issues.push({
            input,
            code: "too_big",
            maximum: Number.MAX_SAFE_INTEGER,
            note: "Integers must be within the safe integer range.",
            inst,
            origin,
            inclusive: true,
            continue: !def.abort
          });
        } else {
          payload.issues.push({
            input,
            code: "too_small",
            minimum: Number.MIN_SAFE_INTEGER,
            note: "Integers must be within the safe integer range.",
            inst,
            origin,
            inclusive: true,
            continue: !def.abort
          });
        }
        return;
      }
    }
    if (input < minimum) {
      payload.issues.push({
        origin: "number",
        input,
        code: "too_small",
        minimum,
        inclusive: true,
        inst,
        continue: !def.abort
      });
    }
    if (input > maximum) {
      payload.issues.push({
        origin: "number",
        input,
        code: "too_big",
        maximum,
        inclusive: true,
        inst,
        continue: !def.abort
      });
    }
  };
});
var $ZodCheckMaxLength = /* @__PURE__ */ $constructor("$ZodCheckMaxLength", (inst, def) => {
  var _a2;
  $ZodCheck.init(inst, def);
  (_a2 = inst._zod.def).when ?? (_a2.when = _whenHasLength);
  inst._zod.check = (payload) => {
    const input = payload.value;
    const units = input.length;
    const length = typeof input === "string" && units > def.maximum ? codePointLength(input) : units;
    if (length <= def.maximum)
      return;
    const origin = getLengthableOrigin(input);
    payload.issues.push({
      origin,
      code: "too_big",
      maximum: def.maximum,
      inclusive: true,
      input,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckStringFormat = /* @__PURE__ */ $constructor("$ZodCheckStringFormat", (inst, def) => {
  var _a2, _b;
  $ZodCheck.init(inst, def);
  if (def.pattern)
    (_a2 = inst._zod).check ?? (_a2.check = (payload) => {
      def.pattern.lastIndex = 0;
      if (def.pattern.test(payload.value))
        return;
      payload.issues.push({
        origin: "string",
        code: "invalid_format",
        format: def.format,
        input: payload.value,
        ...def.pattern ? { pattern: def.pattern.toString() } : {},
        inst,
        continue: !def.abort
      });
    });
  else
    (_b = inst._zod).check ?? (_b.check = () => {
    });
});
var $ZodCheckRegex = /* @__PURE__ */ $constructor("$ZodCheckRegex", (inst, def) => {
  $ZodCheckStringFormat.init(inst, def);
  inst._zod.check = (payload) => {
    def.pattern.lastIndex = 0;
    if (def.pattern.test(payload.value))
      return;
    payload.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "regex",
      input: payload.value,
      pattern: def.pattern.toString(),
      inst,
      continue: !def.abort
    });
  };
});

// node_modules/zod/v4/core/versions.js
var version = {
  major: 4,
  minor: 6,
  patch: 5
};

// node_modules/zod/v4/core/schemas.js
var $ZodType = /* @__PURE__ */ $constructor("$ZodType", (inst, def) => {
  var _a2;
  inst ?? (inst = {});
  inst._zod.def = def;
  inst._zod.bag = inst._zod.bag || {};
  inst._zod.version = version;
  const defChecks = inst._zod.def.checks;
  const checks = inst._zod.traits.has("$ZodCheck") ? [inst, ...defChecks ?? []] : defChecks?.length ? [...defChecks] : [];
  for (const ch of checks) {
    for (const fn of ch._zod.onattach) {
      fn(inst);
    }
  }
  if (checks.length === 0) {
    (_a2 = inst._zod).deferred ?? (_a2.deferred = []);
    inst._zod.deferred?.push(() => {
      inst._zod.run = inst._zod.parse;
    });
  } else {
    const runChecks = (payload, checks2, ctx) => {
      if (payload.memo)
        return payload;
      let isAborted = aborted(payload);
      let asyncResult;
      for (const ch of checks2) {
        if (ch._zod.def.when) {
          if (explicitlyAborted(payload))
            continue;
          const shouldRun = ch._zod.def.when(payload);
          if (!shouldRun)
            continue;
        } else if (isAborted) {
          continue;
        }
        const currLen = payload.issues.length;
        const _ = ch._zod.check(payload);
        if (_ instanceof Promise && ctx?.async === false) {
          throw new $ZodAsyncError();
        }
        if (asyncResult || _ instanceof Promise) {
          asyncResult = (asyncResult ?? Promise.resolve()).then(async () => {
            await _;
            const nextLen = payload.issues.length;
            if (nextLen === currLen)
              return;
            attachSchema(payload.issues, currLen, inst);
            if (!isAborted)
              isAborted = aborted(payload, currLen);
          });
        } else {
          const nextLen = payload.issues.length;
          if (nextLen === currLen)
            continue;
          attachSchema(payload.issues, currLen, inst);
          if (!isAborted)
            isAborted = aborted(payload, currLen);
        }
      }
      if (asyncResult) {
        return asyncResult.then(() => {
          return payload;
        });
      }
      return payload;
    };
    const handleCanaryResult = (canary, payload, ctx) => {
      if (aborted(canary)) {
        canary.aborted = true;
        return canary;
      }
      const checkResult = runChecks(payload, checks, ctx);
      if (checkResult instanceof Promise) {
        if (ctx.async === false)
          throw new $ZodAsyncError();
        return checkResult.then((checkResult2) => inst._zod.parse(checkResult2, ctx));
      }
      return inst._zod.parse(checkResult, ctx);
    };
    inst._zod.run = (payload, ctx) => {
      if (ctx.skipChecks) {
        return inst._zod.parse(payload, ctx);
      }
      if (ctx.direction === "backward") {
        const canary = inst._zod.parse({ value: payload.value, issues: [] }, { ...ctx, skipChecks: true });
        if (canary instanceof Promise) {
          return canary.then((canary2) => {
            return handleCanaryResult(canary2, payload, ctx);
          });
        }
        return handleCanaryResult(canary, payload, ctx);
      }
      const result = inst._zod.parse(payload, ctx);
      if (result instanceof Promise) {
        if (ctx.async === false)
          throw new $ZodAsyncError();
        return result.then((result2) => runChecks(result2, checks, ctx));
      }
      return runChecks(result, checks, ctx);
    };
  }
}, {
  // Wrappers extend this by installing a richer factory over it; reading it eagerly would defeat the laziness.
  get "~standard"() {
    return hide(this, "~standard", standardProps(this));
  },
  set "~standard"(value) {
    own(this, "~standard", value);
  }
});
var toStandardResult = (r, ctx) => r.issues.length ? { issues: r.issues.map((iss) => finalizeIssue(iss, ctx, config())) } : { value: r.value };
async function validateAsync(inst, value) {
  const ctx = { async: true };
  return toStandardResult(await inst._zod.run({ value, issues: [] }, ctx), ctx);
}
function standardProps(inst) {
  return {
    validate: (value) => {
      const ctx = { async: false };
      try {
        const r = inst._zod.run({ value, issues: [] }, ctx);
        if (!(r instanceof Promise))
          return toStandardResult(r, ctx);
      } catch (_) {
      }
      return validateAsync(inst, value);
    },
    vendor: "zod",
    version: 1
  };
}
var $ZodString = /* @__PURE__ */ $constructor("$ZodString", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.pattern = def.pattern ?? anyString;
  inst._zod.parse = (payload, _) => {
    if (def.coerce)
      try {
        payload.value = String(payload.value);
      } catch (_2) {
      }
    if (typeof payload.value === "string")
      return payload;
    payload.issues.push({
      expected: "string",
      code: "invalid_type",
      input: payload.value,
      inst
    });
    return payload;
  };
});
var $ZodNumber = /* @__PURE__ */ $constructor("$ZodNumber", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.pattern = number;
  inst._zod.parse = (payload, _ctx) => {
    if (def.coerce)
      try {
        payload.value = Number(payload.value);
      } catch (_) {
      }
    const input = payload.value;
    if (typeof input === "number" && !Number.isNaN(input) && Number.isFinite(input)) {
      return payload;
    }
    const received = typeof input === "number" ? Number.isNaN(input) ? "NaN" : !Number.isFinite(input) ? String(input) : void 0 : void 0;
    payload.issues.push({
      expected: "number",
      code: "invalid_type",
      input,
      inst,
      ...received ? { received } : {}
    });
    return payload;
  };
});
var $ZodNumberFormat = /* @__PURE__ */ $constructor("$ZodNumberFormat", (inst, def) => {
  $ZodCheckNumberFormat.init(inst, def);
  $ZodNumber.init(inst, def);
});
var $ZodUnknown = /* @__PURE__ */ $constructor("$ZodUnknown", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload) => payload;
});
var $ZodNever = /* @__PURE__ */ $constructor("$ZodNever", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, _ctx) => {
    payload.issues.push({
      expected: "never",
      code: "invalid_type",
      input: payload.value,
      inst
    });
    return payload;
  };
});
function handleArrayResult(result, final, index) {
  if (result.issues.length) {
    final.issues.push(...prefixIssues(index, result.issues));
  }
  final.value[index] = result.value;
}
var $ZodArray = /* @__PURE__ */ $constructor("$ZodArray", (inst, def) => {
  $ZodType.init(inst, def);
  const memo = globalConfig.memoizer;
  memo?.attach(inst);
  inst._zod.parse = (payload, ctx) => {
    const input = payload.value;
    if (!Array.isArray(input)) {
      payload.issues.push({
        expected: "array",
        code: "invalid_type",
        input,
        inst
      });
      return payload;
    }
    payload.value = memo ? memo.alloc(inst, payload, Array(input.length), ctx) : Array(input.length);
    const proms = [];
    const abortEarly = ctx?.abortEarly;
    for (let i = 0; i < input.length; i++) {
      const item = input[i];
      const result = def.element._zod.run({
        value: item,
        issues: []
      }, ctx);
      if (result instanceof Promise) {
        proms.push(result.then((result2) => handleArrayResult(result2, payload, i)));
      } else {
        handleArrayResult(result, payload, i);
        if (abortEarly && result.issues.length !== 0 && aborted(result))
          break;
      }
    }
    if (proms.length) {
      return Promise.all(proms).then(() => payload);
    }
    return payload;
  };
});
function handlePropertyResult(result, final, key, input, optin, optout) {
  const isPresent = key in input;
  const isOptionalOut = optout === "optional";
  if (!isPresent && isOptionalOut && optin === "optional") {
    return;
  }
  if (result.issues.length) {
    if (optin !== void 0 && isOptionalOut && !isPresent) {
      return;
    }
    final.issues.push(...prefixIssues(key, result.issues));
  }
  if (!isPresent && optin === void 0) {
    if (!result.issues.length) {
      final.issues.push({
        code: "invalid_type",
        expected: "nonoptional",
        input: void 0,
        path: [key]
      });
    }
    return;
  }
  if (result.value === void 0) {
    if (isPresent || optin === "defaulted" && !isOptionalOut) {
      final.value[key] = void 0;
    }
  } else {
    final.value[key] = result.value;
  }
}
var NO_SYMBOL_KEYS = [];
function normalizeDef(def) {
  const keys = Object.keys(def.shape);
  const ownSymbols = Object.getOwnPropertySymbols(def.shape);
  const symbolKeys = ownSymbols.length ? ownSymbols : NO_SYMBOL_KEYS;
  const allKeys = symbolKeys.length ? [...keys, ...symbolKeys] : keys;
  for (const k of allKeys) {
    if (!def.shape?.[k]?._zod?.traits?.has("$ZodType")) {
      throw new Error(`Invalid element at key "${String(k)}": expected a Zod schema`);
    }
  }
  const okeys = optionalKeys(def.shape);
  return {
    ...def,
    allKeys,
    symbolKeys,
    // string-only: handleCatchall matches it against `for...in`, which never yields a symbol
    keySet: new Set(keys),
    numKeys: keys.length,
    optionalKeys: new Set(okeys)
  };
}
function handleCatchall(proms, input, payload, ctx, def, inst, abortEarly) {
  const unrecognized = [];
  const keySet = def.keySet;
  const _catchall = def.catchall._zod;
  const t = _catchall.def.type;
  const optin = _catchall.optin;
  const optout = _catchall.optout;
  let seen = 0;
  for (const key in input) {
    if (abortEarly && payload.issues.length !== seen) {
      if (aborted(payload, seen))
        break;
      seen = payload.issues.length;
    }
    if (keySet.has(key))
      continue;
    if (key === "__proto__") {
      if (t === "never")
        unrecognized.push(key);
      continue;
    }
    if (t === "never") {
      unrecognized.push(key);
      continue;
    }
    const r = _catchall.run({ value: input[key], issues: [] }, ctx);
    if (r instanceof Promise) {
      proms.push(r.then((r2) => handlePropertyResult(r2, payload, key, input, optin, optout)));
    } else {
      handlePropertyResult(r, payload, key, input, optin, optout);
    }
  }
  if (unrecognized.length) {
    payload.issues.push({
      code: "unrecognized_keys",
      keys: unrecognized,
      input,
      inst,
      // Describes the shape of the input, not the validity of the parsed value, so it never aborts. The parse still fails; the schema's own checks just get to run first, and an enclosing intersection can reconcile the key against a sibling operand.
      continue: true
    });
  }
  if (!proms.length)
    return payload;
  return Promise.all(proms).then(() => {
    return payload;
  });
}
var $ZodObject = /* @__PURE__ */ $constructor("$ZodObject", (inst, def) => {
  $ZodType.init(inst, def);
  const desc = Object.getOwnPropertyDescriptor(def, "shape");
  const sh = desc?.get ? desc.get.raw : def.shape ?? {};
  if (sh) {
    const get = () => {
      const newSh = { ...sh };
      Object.defineProperty(def, "shape", { value: newSh });
      get.raw = newSh;
      return newSh;
    };
    get.raw = sh;
    Object.defineProperty(def, "shape", { get });
  }
  const _normalized = cached(() => normalizeDef(def));
  defineLazyInternal(inst, "propValues", (zod) => {
    const shape = zod.def.shape;
    const propValues = {};
    for (const key in shape) {
      const field = shape[key]._zod;
      if (field.values) {
        if (!Object.prototype.hasOwnProperty.call(propValues, key)) {
          assignProp(propValues, key, /* @__PURE__ */ new Set());
        }
        for (const v of field.values)
          propValues[key].add(v);
        if (field.optin !== void 0)
          propValues[key].add(void 0);
      }
    }
    return propValues;
  });
  const isObject2 = isObject;
  const catchall = def.catchall;
  let value;
  const memo = globalConfig.memoizer;
  memo?.attach(inst);
  inst._zod.parse = (payload, ctx) => {
    value ?? (value = _normalized.value);
    const input = payload.value;
    if (!isObject2(input)) {
      payload.issues.push({
        expected: "object",
        code: "invalid_type",
        input,
        inst
      });
      return payload;
    }
    payload.value = memo ? memo.alloc(inst, payload, {}, ctx) : {};
    const proms = [];
    const shape = value.shape;
    const abortEarly = ctx?.abortEarly;
    let seen = payload.issues.length;
    for (const key of value.allKeys) {
      if (abortEarly && payload.issues.length !== seen) {
        if (aborted(payload, seen))
          break;
        seen = payload.issues.length;
      }
      if (key === "__proto__")
        continue;
      const el = shape[key];
      const optin = el._zod.optin;
      const optout = el._zod.optout;
      const r = el._zod.run({ value: input[key], issues: [] }, ctx);
      if (r instanceof Promise) {
        proms.push(r.then((r2) => handlePropertyResult(r2, payload, key, input, optin, optout)));
      } else {
        handlePropertyResult(r, payload, key, input, optin, optout);
      }
    }
    if (!catchall) {
      return proms.length ? Promise.all(proms).then(() => payload) : payload;
    }
    return handleCatchall(proms, input, payload, ctx, _normalized.value, inst, abortEarly === true);
  };
});
function handleUnionResults(results, final, inst, ctx) {
  for (const result of results) {
    if (result.issues.length === 0) {
      final.value = result.value;
      return final;
    }
  }
  const nonaborted = results.filter((r) => !aborted(r));
  if (nonaborted.length === 1) {
    final.value = nonaborted[0].value;
    return nonaborted[0];
  }
  final.issues.push({
    code: "invalid_union",
    input: final.value,
    inst,
    errors: results.map((result) => result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
  });
  return final;
}
var $ZodUnion = /* @__PURE__ */ $constructor("$ZodUnion", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazyInternal(inst, "optin", (zod) => zod.def.options.some((o) => o._zod.optin === "defaulted") ? "defaulted" : zod.def.options.some((o) => o._zod.optin !== void 0) ? "optional" : void 0);
  defineLazyInternal(inst, "optout", (zod) => zod.def.options.some((o) => o._zod.optout === "optional") ? "optional" : void 0);
  defineLazyInternal(inst, "values", (zod) => {
    if (zod.def.options.every((o) => o._zod.values)) {
      return new Set(zod.def.options.flatMap((option) => Array.from(option._zod.values)));
    }
    return void 0;
  });
  defineLazyInternal(inst, "pattern", (zod) => {
    if (zod.def.options.every((o) => o._zod.pattern)) {
      const patterns = zod.def.options.map((o) => o._zod.pattern);
      return new RegExp(`^(${patterns.map((p) => cleanRegex(p.source)).join("|")})$`);
    }
    return void 0;
  });
  const first = def.options.length === 1 ? def.options[0]._zod.run : null;
  inst._zod.parse = (payload, ctx) => {
    if (first) {
      return first(payload, ctx);
    }
    let async = false;
    const results = [];
    for (const option of def.options) {
      const result = option._zod.run({
        value: payload.value,
        issues: []
      }, ctx);
      if (result instanceof Promise) {
        results.push(result);
        async = true;
      } else {
        if (result.issues.length === 0)
          return result;
        results.push(result);
      }
    }
    if (!async)
      return handleUnionResults(results, payload, inst, ctx);
    return Promise.all(results).then((results2) => {
      return handleUnionResults(results2, payload, inst, ctx);
    });
  };
});
var $ZodRecord = /* @__PURE__ */ $constructor("$ZodRecord", (inst, def) => {
  $ZodType.init(inst, def);
  const memo = globalConfig.memoizer;
  memo?.attach(inst);
  inst._zod.parse = (payload, ctx) => {
    const input = payload.value;
    if (!isPlainObject(input)) {
      payload.issues.push({
        expected: "record",
        code: "invalid_type",
        input,
        inst
      });
      return payload;
    }
    const proms = [];
    const values = def.keyType._zod.values;
    if (values && !def.partial) {
      payload.value = memo ? memo.alloc(inst, payload, {}, ctx) : {};
      const recordKeys = /* @__PURE__ */ new Set();
      for (const key of values) {
        if (typeof key === "string" || typeof key === "number" || typeof key === "symbol") {
          recordKeys.add(typeof key === "number" ? key.toString() : key);
          if (key === "__proto__")
            continue;
          const keyResult = def.keyType._zod.run({ value: key, issues: [] }, ctx);
          if (keyResult instanceof Promise) {
            throw new Error("Async schemas not supported in object keys currently");
          }
          if (keyResult.issues.length) {
            payload.issues.push({
              code: "invalid_key",
              origin: "record",
              issues: keyResult.issues.map((iss) => finalizeIssue(iss, ctx, config())),
              input: key,
              path: [key],
              inst
            });
            continue;
          }
          const outKey = keyResult.value;
          if (outKey === "__proto__")
            continue;
          const result = def.valueType._zod.run({ value: input[key], issues: [] }, ctx);
          if (result instanceof Promise) {
            proms.push(result.then((result2) => {
              if (result2.issues.length) {
                payload.issues.push(...prefixIssues(key, result2.issues));
              }
              payload.value[outKey] = result2.value;
            }));
          } else {
            if (result.issues.length) {
              payload.issues.push(...prefixIssues(key, result.issues));
            }
            payload.value[outKey] = result.value;
          }
        }
      }
      let unrecognized;
      for (const key in input) {
        if (!recordKeys.has(key)) {
          if (def.mode === "loose") {
            if (key === "__proto__")
              continue;
            payload.value[key] = input[key];
          } else {
            unrecognized = unrecognized ?? [];
            unrecognized.push(key);
          }
        }
      }
      if (unrecognized && unrecognized.length > 0) {
        payload.issues.push({
          code: "unrecognized_keys",
          input,
          inst,
          keys: unrecognized,
          continue: true
        });
      }
    } else {
      payload.value = memo ? memo.alloc(inst, payload, {}, ctx) : {};
      let unrecognized;
      for (const key of Reflect.ownKeys(input)) {
        if (key === "__proto__")
          continue;
        if (!Object.prototype.propertyIsEnumerable.call(input, key))
          continue;
        let keyResult = def.keyType._zod.run({ value: key, issues: [] }, ctx);
        if (keyResult instanceof Promise) {
          throw new Error("Async schemas not supported in object keys currently");
        }
        const checkNumericKey = typeof key === "string" && number.test(key) && keyResult.issues.length;
        if (checkNumericKey) {
          const retryResult = def.keyType._zod.run({ value: Number(key), issues: [] }, ctx);
          if (retryResult instanceof Promise) {
            throw new Error("Async schemas not supported in object keys currently");
          }
          if (retryResult.issues.length === 0) {
            keyResult = retryResult;
          }
        }
        if (keyResult.issues.length) {
          if (def.mode === "loose") {
            payload.value[key] = input[key];
          } else if (values) {
            unrecognized = unrecognized ?? [];
            unrecognized.push(key);
          } else {
            payload.issues.push({
              code: "invalid_key",
              origin: "record",
              issues: keyResult.issues.map((iss) => finalizeIssue(iss, ctx, config())),
              input: key,
              path: [key],
              inst
            });
          }
          continue;
        }
        const outKey = keyResult.value;
        if (outKey === "__proto__")
          continue;
        const result = def.valueType._zod.run({ value: input[key], issues: [] }, ctx);
        if (result instanceof Promise) {
          proms.push(result.then((result2) => {
            if (result2.issues.length) {
              payload.issues.push(...prefixIssues(key, result2.issues));
            }
            payload.value[outKey] = result2.value;
          }));
        } else {
          if (result.issues.length) {
            payload.issues.push(...prefixIssues(key, result.issues));
          }
          payload.value[outKey] = result.value;
        }
      }
      if (unrecognized && unrecognized.length > 0) {
        payload.issues.push({
          code: "unrecognized_keys",
          input,
          inst,
          keys: unrecognized,
          continue: true
        });
      }
    }
    if (proms.length) {
      return Promise.all(proms).then(() => payload);
    }
    return payload;
  };
});
var $ZodLiteral = /* @__PURE__ */ $constructor("$ZodLiteral", (inst, def) => {
  $ZodType.init(inst, def);
  const values = new Set(def.values);
  inst._zod.values = values;
  defineLazyInternal(inst, "pattern", (zod) => {
    const vals = zod.def.values;
    return new RegExp(vals.length ? `^(${vals.map((o) => typeof o === "string" ? escapeRegex(o) : o ? escapeRegex(o.toString()) : String(o)).join("|")})$` : "^[^\\s\\S]$");
  });
  inst._zod.parse = (payload, _ctx) => {
    const input = payload.value;
    if (values.has(input)) {
      return payload;
    }
    payload.issues.push({
      code: "invalid_value",
      values: def.values,
      input,
      inst
    });
    return payload;
  };
});
var $ZodReadonly = /* @__PURE__ */ $constructor("$ZodReadonly", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazyInternal(inst, "propValues", (zod) => zod.def.innerType._zod.propValues);
  defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
  defineLazyInternal(inst, "optin", (zod) => zod.def.innerType?._zod?.optin);
  defineLazyInternal(inst, "optout", (zod) => zod.def.innerType?._zod?.optout);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      return def.innerType._zod.run(payload, ctx);
    }
    const result = def.innerType._zod.run(payload, ctx);
    if (result instanceof Promise) {
      return result.then(handleReadonlyResult);
    }
    return handleReadonlyResult(result);
  };
});
function handleReadonlyResult(payload) {
  if (!payload.memo)
    payload.value = Object.freeze(payload.value);
  return payload;
}
var $ZodCustom = /* @__PURE__ */ $constructor("$ZodCustom", (inst, def) => {
  $ZodCheck.init(inst, def);
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, _) => {
    return payload;
  };
  inst._zod.check = (payload) => {
    const input = payload.value;
    const r = def.fn(input);
    if (r instanceof Promise) {
      return r.then((r2) => handleRefineResult(r2, payload, input, inst));
    }
    handleRefineResult(r, payload, input, inst);
    return;
  };
});
function handleRefineResult(result, payload, input, inst) {
  if (!result) {
    const _iss = {
      code: "custom",
      input,
      inst,
      // incorporates params.error into issue reporting
      path: [...inst._zod.def.path ?? []],
      // incorporates params.error into issue reporting
      continue: !inst._zod.def.abort
      // params: inst._zod.def.params,
    };
    if (inst._zod.def.params)
      _iss.params = inst._zod.def.params;
    payload.issues.push(issue(_iss));
  }
}

// node_modules/zod/v4/core/api.js
function snapshotChecks(def) {
  if (def.checks)
    def.checks = [...def.checks];
  return def;
}
// @__NO_SIDE_EFFECTS__
function _string(Class, params) {
  return new Class(snapshotChecks({ type: "string", ...normalizeParams(params) }));
}
// @__NO_SIDE_EFFECTS__
function _int(Class, params) {
  return new Class({
    type: "number",
    check: "number_format",
    abort: false,
    format: "safeint",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _unknown(Class) {
  return new Class({
    type: "unknown"
  });
}
// @__NO_SIDE_EFFECTS__
function _never(Class, params) {
  return new Class({
    type: "never",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _gt(value, params) {
  return new $ZodCheckGreaterThan({
    check: "greater_than",
    ...normalizeParams(params),
    value,
    inclusive: false
  });
}
// @__NO_SIDE_EFFECTS__
function _positive(params) {
  return /* @__PURE__ */ _gt(0, params);
}
// @__NO_SIDE_EFFECTS__
function _maxLength(maximum, params) {
  const ch = new $ZodCheckMaxLength({
    check: "max_length",
    ...normalizeParams(params),
    maximum
  });
  return ch;
}
// @__NO_SIDE_EFFECTS__
function _regex(pattern, params) {
  return new $ZodCheckRegex({
    check: "string_format",
    format: "regex",
    ...normalizeParams(params),
    pattern
  });
}
// @__NO_SIDE_EFFECTS__
function _refine(Class, fn, _params) {
  const schema = new Class({
    type: "custom",
    check: "custom",
    fn,
    ...normalizeParams(_params)
  });
  return schema;
}

// node_modules/zod/v4/mini/schemas.js
var ZodMiniType = /* @__PURE__ */ $constructor("ZodMiniType", (inst, def) => {
  if (!inst._zod)
    throw new Error("Uninitialized schema in ZodMiniType.");
  $ZodType.init(inst, def);
  inst.def = def;
  inst.type = def.type;
}, {
  // `with` is an alias for `check`: the same function object, not a wrapper.
  get with() {
    return this.check;
  },
  set with(value) {
    own(this, "with", value);
  },
  parse(data, params) {
    return parse(this, data, params, { callee: this.parse });
  },
  parseAsync(data, params) {
    return parseAsync(this, data, params, { callee: this.parseAsync });
  },
  safeParse(data, params) {
    return safeParse(this, data, params);
  },
  safeParseAsync(data, params) {
    return safeParseAsync(this, data, params);
  },
  check(...checks) {
    const def = this.def;
    return this.clone({
      ...def,
      checks: [
        ...def.checks ?? [],
        ...checks.map((ch) => typeof ch === "function" ? { _zod: { check: ch, def: { check: "custom" }, onattach: [] } } : ch)
      ]
    }, { parent: true });
  },
  clone(_def, params) {
    return clone(this, _def, params);
  },
  brand() {
    return this;
  },
  register(reg, meta2) {
    reg.add(this, meta2);
    return this;
  },
  apply(fn, ...args) {
    return args.length === 0 ? fn(this) : fn(this, ...args);
  }
});
var ZodMiniString = /* @__PURE__ */ $constructor("ZodMiniString", (inst, def) => {
  $ZodString.init(inst, def);
  ZodMiniType.init(inst, def);
});
// @__NO_SIDE_EFFECTS__
function string2(params) {
  return _string(ZodMiniString, params);
}
var ZodMiniNumber = /* @__PURE__ */ $constructor("ZodMiniNumber", (inst, def) => {
  $ZodNumber.init(inst, def);
  ZodMiniType.init(inst, def);
});
var ZodMiniNumberFormat = /* @__PURE__ */ $constructor("ZodMiniNumberFormat", (inst, def) => {
  $ZodNumberFormat.init(inst, def);
  ZodMiniNumber.init(inst, def);
});
function int(params) {
  return _int(ZodMiniNumberFormat, params);
}
var ZodMiniUnknown = /* @__PURE__ */ $constructor("ZodMiniUnknown", (inst, def) => {
  $ZodUnknown.init(inst, def);
  ZodMiniType.init(inst, def);
});
// @__NO_SIDE_EFFECTS__
function unknown() {
  return _unknown(ZodMiniUnknown);
}
var ZodMiniNever = /* @__PURE__ */ $constructor("ZodMiniNever", (inst, def) => {
  $ZodNever.init(inst, def);
  ZodMiniType.init(inst, def);
});
// @__NO_SIDE_EFFECTS__
function never(params) {
  return _never(ZodMiniNever, params);
}
var ZodMiniArray = /* @__PURE__ */ $constructor("ZodMiniArray", (inst, def) => {
  $ZodArray.init(inst, def);
  ZodMiniType.init(inst, def);
});
// @__NO_SIDE_EFFECTS__
function array(element, params) {
  return new ZodMiniArray({
    type: "array",
    element,
    ...normalizeParams(params)
  });
}
var ZodMiniObject = /* @__PURE__ */ $constructor("ZodMiniObject", (inst, def) => {
  $ZodObject.init(inst, def);
  ZodMiniType.init(inst, def);
  installLazyProp(inst, "shape", (self) => self._zod.def.shape, false);
});
// @__NO_SIDE_EFFECTS__
function object(shape, params) {
  const def = {
    type: "object",
    shape: shape ?? {},
    ...normalizeParams(params)
  };
  return new ZodMiniObject(def);
}
// @__NO_SIDE_EFFECTS__
function strictObject(shape, params) {
  return new ZodMiniObject({
    type: "object",
    shape,
    catchall: /* @__PURE__ */ never(),
    ...normalizeParams(params)
  });
}
var ZodMiniUnion = /* @__PURE__ */ $constructor("ZodMiniUnion", (inst, def) => {
  $ZodUnion.init(inst, def);
  ZodMiniType.init(inst, def);
});
// @__NO_SIDE_EFFECTS__
function union(options, params) {
  return new ZodMiniUnion({
    type: "union",
    options,
    ...normalizeParams(params)
  });
}
var ZodMiniRecord = /* @__PURE__ */ $constructor("ZodMiniRecord", (inst, def) => {
  $ZodRecord.init(inst, def);
  ZodMiniType.init(inst, def);
});
// @__NO_SIDE_EFFECTS__
function record(keyType, valueType, params) {
  if (!valueType || !valueType._zod) {
    return new ZodMiniRecord({
      type: "record",
      keyType: /* @__PURE__ */ string2(),
      valueType: keyType,
      ...normalizeParams(valueType)
    });
  }
  return new ZodMiniRecord({
    type: "record",
    keyType,
    valueType,
    ...normalizeParams(params)
  });
}
var ZodMiniLiteral = /* @__PURE__ */ $constructor("ZodMiniLiteral", (inst, def) => {
  $ZodLiteral.init(inst, def);
  ZodMiniType.init(inst, def);
});
// @__NO_SIDE_EFFECTS__
function literal(value, params) {
  return new ZodMiniLiteral({
    type: "literal",
    values: Array.isArray(value) ? value : [value],
    ...normalizeParams(params)
  });
}
var ZodMiniReadonly = /* @__PURE__ */ $constructor("ZodMiniReadonly", (inst, def) => {
  $ZodReadonly.init(inst, def);
  ZodMiniType.init(inst, def);
});
// @__NO_SIDE_EFFECTS__
function readonly(innerType) {
  return new ZodMiniReadonly({
    type: "readonly",
    innerType
  });
}
var ZodMiniCustom = /* @__PURE__ */ $constructor("ZodMiniCustom", (inst, def) => {
  $ZodCustom.init(inst, def);
  ZodMiniType.init(inst, def);
});
// @__NO_SIDE_EFFECTS__
function refine(fn, _params = {}) {
  return _refine(ZodMiniCustom, fn, _params);
}

// app/types/browser.ts
var QuestionIdSchema = string2("questionId \u306F\u6587\u5B57\u5217\u3067\u3042\u308B\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059").check(
  _regex(
    /^exam[1-9]-(2013|2014|2015|2016|2017)-q[1-9]\d*$/,
    "questionId \u306F exam{1-9}-{2013..2017}-q{positive} \u5F62\u5F0F\u3067\u3042\u308B\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059"
  )
).brand();
var UnitTabIdSchema = string2("unit id \u306F\u6587\u5B57\u5217\u3067\u3042\u308B\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059").check(
  _regex(
    /^unit-[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "unit id \u306F unit-{kebab-case} \u5F62\u5F0F\u3067\u3042\u308B\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059"
  )
).brand();
var EpochMillisecondsSchema = int().check(_positive()).brand();
var ExamIdSchema = string2().check(_regex(/^exam[1-9]-(2013|2014|2015|2016|2017)$/)).brand();
var ChallengeIdSchema = string2().check(_regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)).brand();
var JudgmentSchema = union([literal("correct"), literal("incorrect")]);
var SyncKeySchema = string2().check(_regex(/^[A-Za-z0-9_-]{43}$/, "\u540C\u671F\u30AD\u30FC\u306E\u5F62\u5F0F\u304C\u6B63\u3057\u304F\u3042\u308A\u307E\u305B\u3093")).brand();
var ProgressEntrySchema = readonly(
  strictObject({
    questionId: QuestionIdSchema,
    unitId: UnitTabIdSchema,
    createdAt: EpochMillisecondsSchema,
    updatedAt: EpochMillisecondsSchema
  })
).check(
  refine(
    (entry) => entry.createdAt <= entry.updatedAt,
    "createdAt\u306FupdatedAt\u4EE5\u4E0B\u3067\u3042\u308B\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059"
  )
);
var ProgressEntryListSchema = readonly(array(ProgressEntrySchema));
var ProgressSyncRequestSchema = readonly(
  strictObject({
    entries: readonly(array(ProgressEntrySchema).check(_maxLength(300)))
  })
);
var SyncHeaderSchema = object({
  "x-sync-key": SyncKeySchema
});
var ProgressSnapshotSchema = record(string2(), unknown());

// app/features/challenge/storage.ts
var ACTIVE_CHALLENGES_STORAGE_KEY = "fit-challenge-active-v1";
var CHALLENGE_HISTORY_STORAGE_KEY = "fit-challenge-history-v1";
var CHALLENGE_CHANGE_EVENT = "fit:challenge-change";
function isJudgment(value) {
  return JudgmentSchema.safeParse(value).success;
}
function isQuestionId(value) {
  return QuestionIdSchema.safeParse(value).success;
}
function isNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}
function isEpochMilliseconds(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
function isSnapshot(value) {
  if (!isRecord3(value)) {
    return false;
  }
  const raw = value;
  const createdAt = raw.createdAt;
  const updatedAt = raw.updatedAt;
  const questionIds = raw.questionIds;
  const revealedQuestionIds = raw.revealedQuestionIds;
  const judgments = raw.judgments;
  const answerCreatedAt = raw.answerCreatedAt;
  const questionElapsedMs = raw.questionElapsedMs;
  if (raw.version !== 1 || !ChallengeIdSchema.safeParse(raw.challengeId).success || typeof raw.scopeKey !== "string" || !ExamIdSchema.safeParse(raw.examId).success || raw.mode !== "exam" && raw.mode !== "question" || !Array.isArray(questionIds) || questionIds.length === 0 || !questionIds.every(isQuestionId) || !isEpochMilliseconds(createdAt) || updatedAt !== null && !isEpochMilliseconds(updatedAt) || typeof raw.currentIndex !== "number" || !Number.isInteger(raw.currentIndex) || raw.currentIndex < 0 || raw.currentIndex >= questionIds.length || !Array.isArray(revealedQuestionIds) || !revealedQuestionIds.every(isQuestionId) || raw.status !== "active" && raw.status !== "incomplete" && raw.status !== "completed" || !isRecord3(judgments) || !isRecord3(answerCreatedAt) || !isRecord3(questionElapsedMs)) {
    return false;
  }
  const questionSet = new Set(questionIds);
  return Object.entries(judgments).every(
    ([questionId, judgment]) => questionSet.has(questionId) && isJudgment(judgment)
  ) && Object.entries(answerCreatedAt).every(
    ([questionId, timestamp]) => questionSet.has(questionId) && isEpochMilliseconds(timestamp) && timestamp >= createdAt
  ) && Object.entries(questionElapsedMs).every(
    ([questionId, elapsedMs]) => questionSet.has(questionId) && isNumber(elapsedMs) && elapsedMs >= 0
  ) && Object.keys(judgments).length === Object.keys(answerCreatedAt).length && Object.keys(judgments).every((id) => Object.hasOwn(answerCreatedAt, id)) && Object.keys(judgments).every(
    (id) => revealedQuestionIds.some((questionId) => questionId === id)
  ) && new Set(questionIds).size === questionIds.length && new Set(revealedQuestionIds).size === revealedQuestionIds.length && revealedQuestionIds.every((id) => questionSet.has(id)) && raw.status === "completed" === (updatedAt !== null) && (updatedAt === null || updatedAt >= createdAt) && (raw.status !== "completed" || Object.keys(judgments).length === questionIds.length);
}
function notifyChallengeChange() {
  window.dispatchEvent(new Event(CHALLENGE_CHANGE_EVENT));
}
function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}
function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    notifyChallengeChange();
    return true;
  } catch {
    return false;
  }
}
function readActiveChallenges() {
  const parsed = readJson(ACTIVE_CHALLENGES_STORAGE_KEY);
  if (!isRecord3(parsed)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(parsed).flatMap(([challengeId, snapshot]) => {
      if (!isSnapshot(snapshot) || snapshot.challengeId !== challengeId || snapshot.status !== "active") {
        return [];
      }
      return [[challengeId, snapshot]];
    })
  );
}
function readChallengeHistory() {
  const parsed = readJson(CHALLENGE_HISTORY_STORAGE_KEY);
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.filter(isSnapshot).filter((snapshot) => snapshot.status !== "active");
}
function findActiveChallenge(scopeKey) {
  return Object.values(readActiveChallenges()).find((snapshot) => snapshot.scopeKey === scopeKey);
}
function findChallenge(challengeId) {
  return readActiveChallenges()[challengeId] ?? readChallengeHistory().find((snapshot) => snapshot.challengeId === challengeId);
}
function saveActiveChallenge(state) {
  const active = { ...readActiveChallenges(), [state.challengeId]: createChallengeSnapshot(state) };
  return writeJson(ACTIVE_CHALLENGES_STORAGE_KEY, active);
}
function writeHistory(history) {
  return writeJson(CHALLENGE_HISTORY_STORAGE_KEY, history);
}
function removeActiveChallenge(challengeId) {
  return Object.fromEntries(
    Object.entries(readActiveChallenges()).filter(([id]) => id !== challengeId)
  );
}
function archiveChallenge(state) {
  const snapshot = createChallengeSnapshot(state);
  const history = [
    snapshot,
    ...readChallengeHistory().filter((item) => item.challengeId !== state.challengeId)
  ];
  const activeSaved = writeJson(
    ACTIVE_CHALLENGES_STORAGE_KEY,
    removeActiveChallenge(state.challengeId)
  );
  const historySaved = writeHistory(history);
  return activeSaved && historySaved;
}
function readCompletedChallenges() {
  return readChallengeHistory().flatMap((snapshot) => {
    if (snapshot.status !== "completed") {
      return [];
    }
    const payload = toCompletedChallengePayload(
      restoreChallengeState(snapshot),
      snapshot.updatedAt
    );
    return payload ? [payload] : [];
  });
}
function archiveCompletedChallenge(state, updatedAt) {
  if (state.status !== "active") {
    return null;
  }
  const completed = { ...state, status: "completed", updatedAt };
  const payload = toCompletedChallengePayload(completed, updatedAt);
  if (!payload) {
    return null;
  }
  return { payload, persisted: archiveChallenge(completed) };
}
function createChallengeStateFromSnapshot(snapshot) {
  return restoreChallengeState(snapshot);
}

// app/features/challenge/player/id.ts
function generateChallengeId() {
  if (typeof crypto.randomUUID === "function") {
    return ChallengeIdSchema.parse(crypto.randomUUID());
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = bytes[6] & 15 | 64;
  bytes[8] = bytes[8] & 63 | 128;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return ChallengeIdSchema.parse(
    `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  );
}

// app/features/challenge/player/initialView.ts
function readInitialChallengeView(search) {
  const query = new URLSearchParams(search);
  const challenge = ChallengeIdSchema.safeParse(query.get("challenge"));
  return {
    view: query.get("view") === "result" ? "result" : "player",
    challengeId: challenge.success ? challenge.data : void 0
  };
}

// app/features/challenge/player/model.ts
function createPlayerChallenge(props, questions, scopeKey, requestedIndex, activeQuestionId, getQuestionIndex, challengeId, createdAt) {
  const requestedQuestionIndex = requestedIndex ?? (props.mode === "question" ? getQuestionIndex(activeQuestionId ?? props.requestedQuestionId) : 0);
  const initialIndex = Math.min(
    Math.max(requestedQuestionIndex, 0),
    Math.max(questions.length - 1, 0)
  );
  const question = questions[initialIndex] ?? questions[0];
  if (!question) {
    return null;
  }
  const questionIds = props.mode === "question" ? [question.id] : questions.map((item) => item.id);
  const challengeScopeKey = props.mode === "question" ? questionScopeKey(props.examId, props.mode, question.id) : scopeKey;
  const state = createInitialChallengeState({
    challengeId,
    scopeKey: challengeScopeKey,
    examId: props.examId,
    mode: props.mode,
    questionIds,
    createdAt,
    initialIndex: props.mode === "question" ? 0 : initialIndex
  });
  return { state, question };
}
function questionScopeKey(examId, mode, questionId) {
  return `${examId}/${mode === "question" ? `question/${questionId ?? ""}` : "exam"}`;
}
function filterChallengeHistory(history, examId, mode, requestedQuestionId) {
  return history.filter((item) => {
    if (item.examId !== examId) {
      return false;
    }
    if (mode === "exam") {
      return item.answers.length > 1;
    }
    return item.answers.length === 1 && item.answers[0]?.questionId === requestedQuestionId;
  });
}
function getNavigationPosition(mode, currentQuestionId, state, questions, getQuestionIndex) {
  return {
    currentQuestionIndex: mode === "question" ? getQuestionIndex(currentQuestionId) : state.currentIndex,
    navigationLength: mode === "question" ? questions.length : state.questionIds.length
  };
}

// app/features/challenge/player/initialPlayerSession.ts
var emptySession = {
  kind: "server",
  state: null,
  phase: "player",
  resultPayload: null,
  resultHistory: []
};
function getHistoryForScope(props, payload) {
  const questionId = props.mode === "question" ? payload.answers[0]?.questionId ?? props.requestedQuestionId : props.requestedQuestionId;
  return filterChallengeHistory(readCompletedChallenges(), payload.examId, props.mode, questionId);
}
function resolveInitialResult(props) {
  const { view, challengeId } = readInitialChallengeView(window.location.search);
  if (view !== "result") {
    return null;
  }
  if (!challengeId) {
    return { ...emptySession, kind: "missing", phase: "missing" };
  }
  const snapshot = findChallenge(challengeId);
  if (snapshot?.status !== "completed") {
    return { ...emptySession, kind: "missing", phase: "missing" };
  }
  const payload = toCompletedChallengePayload(restoreChallengeState(snapshot), snapshot.updatedAt);
  if (!payload) {
    return { ...emptySession, kind: "missing", phase: "missing" };
  }
  return {
    kind: "result",
    state: null,
    phase: "result",
    resultPayload: payload,
    resultHistory: getHistoryForScope(props, payload)
  };
}
function resolveInitialPlayerSession(props) {
  if (typeof window === "undefined") {
    return emptySession;
  }
  const result = resolveInitialResult(props);
  if (result) {
    return result;
  }
  const scopeKey = questionScopeKey(props.examId, props.mode, props.requestedQuestionId);
  const active = findActiveChallenge(scopeKey);
  if (active) {
    return {
      kind: "resume",
      state: createChallengeStateFromSnapshot(active),
      phase: "resume",
      resultPayload: null,
      resultHistory: []
    };
  }
  const challenge = createPlayerChallenge(
    props,
    props.questions,
    scopeKey,
    void 0,
    props.requestedQuestionId,
    (questionId) => props.questions.findIndex((question) => question.id === questionId),
    generateChallengeId(),
    systemClock.nowEpochMilliseconds()
  );
  if (!challenge) {
    return { ...emptySession, kind: "missing", phase: "missing" };
  }
  return {
    kind: "new",
    state: challenge.state,
    phase: "player",
    resultPayload: null,
    resultHistory: []
  };
}

// app/features/challenge/player/navigation.ts
function replaceChallengeView(view, challengeId) {
  const url = new URL(window.location.href);
  if (view === "result" && challengeId) {
    url.searchParams.set("view", "result");
    url.searchParams.set("challenge", challengeId);
  } else {
    url.searchParams.delete("view");
    url.searchParams.delete("challenge");
  }
  window.history.replaceState(null, "", url);
}
function replaceQuestionInUrl(questionId) {
  const url = new URL(window.location.href);
  const path = url.pathname.split("/");
  if (path.at(-2) === "question") {
    path[path.length - 1] = questionId;
    url.pathname = path.join("/");
  }
  url.searchParams.delete("question");
  window.history.replaceState(null, "", url);
}

// app/features/challenge/player/timerRuntime.ts
function projectElapsedTime(baseElapsedMs, running, startedAt, now) {
  if (!running || startedAt === null) {
    return baseElapsedMs;
  }
  const delta = now - startedAt;
  if (!Number.isFinite(delta) || delta < 0 || delta > MAX_REASONABLE_TIMER_DELTA_MS) {
    return baseElapsedMs;
  }
  return baseElapsedMs + delta;
}
function sampleChallengeTimer(state, runtime, now) {
  const deltaMs = calculateElapsedDelta(runtime, now);
  runtime.lastSample = now;
  if (deltaMs <= 0) {
    return { state, deltaMs: 0 };
  }
  return {
    state: applyElapsedDelta(state, runtime.currentQuestionId, deltaMs),
    deltaMs
  };
}
function resetTimerRuntimeInPlace(runtime, questionId) {
  if (questionId) {
    runtime.currentQuestionId = questionId;
  }
  runtime.lastSample = null;
  runtime.running = false;
}

// node_modules/@remix-run/ui/dist/animation/animate-mixins.js
var DEFAULT_ENTER = {
  opacity: 0,
  duration: 150,
  easing: "ease-out"
};
var DEFAULT_EXIT = {
  opacity: 0,
  duration: 150,
  easing: "ease-in"
};
var animatingNodes = /* @__PURE__ */ new WeakMap();
var initialEntranceSeenByParent = /* @__PURE__ */ new WeakMap();
function extractStyleProps(config2) {
  let result = {};
  for (let key in config2) {
    if (key === "duration" || key === "easing" || key === "delay" || key === "composite" || key === "initial") {
      continue;
    }
    let value = config2[key];
    if (value === void 0)
      continue;
    if (typeof value !== "string" && typeof value !== "number")
      continue;
    result[key] = value;
  }
  return result;
}
function buildEnterKeyframes(config2) {
  let keyframe = extractStyleProps(config2);
  return [keyframe, {}];
}
function buildExitKeyframes(config2) {
  let keyframe = extractStyleProps(config2);
  return [{}, keyframe];
}
function resolveEnterConfig(config2) {
  if (!config2)
    return null;
  if (config2 === true)
    return DEFAULT_ENTER;
  return config2;
}
function resolveExitConfig(config2) {
  if (!config2)
    return null;
  if (config2 === true)
    return DEFAULT_EXIT;
  return config2;
}
function createAnimationOptions(config2, fill) {
  return {
    duration: config2.duration,
    delay: config2.delay,
    easing: config2.easing,
    composite: config2.composite,
    fill
  };
}
function collectAnimatedProperties(keyframes) {
  let properties = /* @__PURE__ */ new Set();
  for (let keyframe of keyframes) {
    for (let key in keyframe) {
      if (key === "offset" || key === "easing" || key === "composite")
        continue;
      properties.add(key);
    }
  }
  return [...properties];
}
function toCssPropertyName(property) {
  return property.includes("-") ? property : property.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
}
function readInlineStyle(style, property) {
  return style.getPropertyValue(toCssPropertyName(property));
}
function writeInlineStyle(style, property, value) {
  let cssProperty = toCssPropertyName(property);
  if (value === "") {
    style.removeProperty(cssProperty);
    return;
  }
  style.setProperty(cssProperty, value);
}
function trackAnimation(node, animation, keyframes) {
  let properties = collectAnimatedProperties(keyframes);
  animatingNodes.set(node, { animation, properties });
  animation.finished.catch(() => {
  }).finally(() => {
    let current = animatingNodes.get(node);
    if (current?.animation !== animation)
      return;
    animatingNodes.delete(node);
  });
}
function waitForAnimationOrAbort(animation, signal) {
  if (signal.aborted)
    return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    let settle = () => {
      if (settled)
        return;
      settled = true;
      signal.removeEventListener("abort", settle);
      resolve();
    };
    signal.addEventListener("abort", settle, { once: true });
    void animation.finished.catch(() => {
    }).finally(settle);
  });
}
function shouldSkipInitialEntrance(event, config2) {
  if (config2.initial !== false)
    return false;
  if (event.key == null)
    return false;
  let seenForParent = initialEntranceSeenByParent.get(event.parent);
  if (!seenForParent) {
    seenForParent = /* @__PURE__ */ new Set();
    initialEntranceSeenByParent.set(event.parent, seenForParent);
  }
  if (seenForParent.has(event.key))
    return false;
  seenForParent.add(event.key);
  return true;
}
var animateEntranceMixin = createMixin((handle) => {
  let currentConfig = true;
  handle.addEventListener("insert", (event) => {
    let node = event.node;
    let current = animatingNodes.get(node);
    if (current && current.animation.playState === "running") {
      return;
    }
    let config2 = resolveEnterConfig(currentConfig);
    if (!config2)
      return;
    if (shouldSkipInitialEntrance(event, config2))
      return;
    let keyframes = buildEnterKeyframes(config2);
    let options = createAnimationOptions(config2, "backwards");
    let animation = node.animate(keyframes, options);
    trackAnimation(node, animation, keyframes);
  });
  return (config2) => {
    currentConfig = config2;
    return handle.element;
  };
});
var animateExitMixin = createMixin((handle) => {
  let currentConfig = true;
  let node = null;
  handle.addEventListener("insert", (event) => {
    node = event.node;
  });
  handle.addEventListener("reclaimed", (event) => {
    node = event.node;
    let current = animatingNodes.get(event.node);
    if (current && current.animation.playState === "running") {
      try {
        current.animation.commitStyles();
      } catch {
      }
      current.animation.cancel();
      let style = event.node.style;
      let computed = getComputedStyle(event.node);
      let from = {};
      for (let property of current.properties) {
        let cssProperty = toCssPropertyName(property);
        let value = readInlineStyle(style, property) || computed.getPropertyValue(cssProperty);
        if (value !== "") {
          from[property] = value;
        }
        writeInlineStyle(style, property, "");
      }
      let enterConfig = resolveEnterConfig(currentConfig) ?? DEFAULT_ENTER;
      let keyframes = [from, {}];
      let options = createAnimationOptions(enterConfig, "none");
      let animation = event.node.animate(keyframes, options);
      trackAnimation(event.node, animation, keyframes);
    }
  });
  handle.addEventListener("beforeRemove", (event) => {
    let config2 = resolveExitConfig(currentConfig);
    if (!config2)
      return;
    event.persistNode(async (signal) => {
      if (!node)
        throw new Error("Cannot animate an element before it is inserted");
      let current = animatingNodes.get(node);
      if (current && current.animation.playState === "running") {
        current.animation.reverse();
        await waitForAnimationOrAbort(current.animation, signal);
        return;
      }
      let keyframes = buildExitKeyframes(config2);
      let options = createAnimationOptions(config2, "forwards");
      let animation = node.animate(keyframes, options);
      trackAnimation(node, animation, keyframes);
      await waitForAnimationOrAbort(animation, signal);
    });
  });
  return (config2) => {
    currentConfig = config2;
    return handle.element;
  };
});
function animateEntrance(config2 = true) {
  return animateEntranceMixin(config2);
}
function animateExit(config2 = true) {
  return animateExitMixin(config2);
}

// node_modules/@remix-run/ui/dist/animation/spring.js
var presets = {
  smooth: { duration: 400, bounce: -0.3 },
  snappy: { duration: 200, bounce: 0 },
  bouncy: { duration: 400, bounce: 0.3 }
};
var restSpeed = 0.01;
var restDelta = 5e-3;
var maxSettlingTime = 2e4;
var frameMs = 1e3 / 60;
function createSpring(presetOrOptions, overrides) {
  let options = resolveOptions(presetOrOptions, overrides);
  let { position, settlingTime, easing } = computeSpring(options);
  let duration2 = Math.round(settlingTime);
  function* generator() {
    let t = 0;
    while (t < settlingTime) {
      yield position(t);
      t += frameMs;
    }
    yield 1;
  }
  let iter = generator();
  Object.defineProperties(iter, {
    duration: { value: duration2, enumerable: true },
    easing: { value: easing, enumerable: true },
    toString: {
      value() {
        return `${duration2}ms ${easing}`;
      }
    }
  });
  return iter;
}
function transition(property, presetOrOptions, overrides) {
  let s = typeof presetOrOptions === "string" ? createSpring(presetOrOptions, overrides) : createSpring(presetOrOptions);
  let properties = Array.isArray(property) ? property : [property];
  return properties.map((p) => `${p} ${s}`).join(", ");
}
var spring = Object.assign(createSpring, {
  transition,
  presets
});
function resolveOptions(presetOrOptions, overrides) {
  if (typeof presetOrOptions === "string") {
    let preset = presets[presetOrOptions];
    return {
      duration: overrides?.duration ?? preset.duration,
      bounce: preset.bounce,
      velocity: overrides?.velocity
    };
  }
  if (presetOrOptions) {
    return presetOrOptions;
  }
  return presets.snappy;
}
function computeSpring(options) {
  let { duration: durationMs = 300, bounce = 0, velocity = 0 } = options;
  let durationSec = durationMs / 1e3;
  let omega0 = 2 * Math.PI / durationSec;
  bounce = Math.max(-1, Math.min(0.95, bounce));
  let zeta = bounce >= 0 ? 1 - bounce : 1 / (1 + bounce);
  let omega0Ms = omega0 / 1e3;
  let velocityMs = -velocity / 1e3;
  let position;
  if (zeta < 1) {
    let omegaD = omega0Ms * Math.sqrt(1 - zeta * zeta);
    position = (t) => {
      let envelope = Math.exp(-zeta * omega0Ms * t);
      return 1 - envelope * ((velocityMs + zeta * omega0Ms) / omegaD * Math.sin(omegaD * t) + Math.cos(omegaD * t));
    };
  } else if (zeta > 1) {
    let sqrtTerm = Math.sqrt(zeta * zeta - 1);
    let s1 = omega0Ms * (-zeta + sqrtTerm);
    let s2 = omega0Ms * (-zeta - sqrtTerm);
    let A = (s2 + velocityMs) / (s2 - s1);
    let B = 1 - A;
    position = (t) => 1 - A * Math.exp(s1 * t) - B * Math.exp(s2 * t);
  } else {
    position = (t) => 1 - Math.exp(-omega0Ms * t) * (1 + (velocityMs + omega0Ms) * t);
  }
  let velocitySampleMs = 0.5;
  function velocityAt(t) {
    if (t < velocitySampleMs) {
      return (position(velocitySampleMs) - position(0)) / velocitySampleMs * 1e3;
    }
    return (position(t) - position(t - velocitySampleMs)) / velocitySampleMs * 1e3;
  }
  let settlingTime = maxSettlingTime;
  let step = 50;
  for (let t = 0; t < maxSettlingTime; t += step) {
    let pos = position(t);
    let vel = Math.abs(velocityAt(t));
    let displacement = Math.abs(1 - pos);
    if (vel <= restSpeed && displacement <= restDelta) {
      settlingTime = t;
      break;
    }
  }
  let easing = generateEasing(position, settlingTime);
  return { position, settlingTime, easing };
}
function generateEasing(position, settlingTime) {
  let points = adaptiveSample(position, settlingTime);
  return `linear(${points.map((p, i) => {
    let isLast = i === points.length - 1;
    let value = isLast ? 1 : Math.round(p.value * 1e4) / 1e4;
    if (i === 0 || isLast) {
      return value === 1 ? "1" : value.toString();
    }
    let percent = Math.round(p.t / settlingTime * 1e3) / 10;
    return `${value} ${percent}%`;
  }).join(", ")})`;
}
function adaptiveSample(resolve, duration2, tolerance = 2e-3, minSegment = 8) {
  let points = [];
  function addPoint(t, value) {
    if (points.length === 0 || points[points.length - 1].t < t) {
      points.push({ t, value });
    }
  }
  function subdivide(t0, v0, t1, v1, depth = 0) {
    if (depth > 12) {
      addPoint(t0, v0);
      return;
    }
    let tMid = (t0 + t1) / 2;
    let vMid = resolve(tMid);
    let vLinear = (v0 + v1) / 2;
    let error = Math.abs(vMid - vLinear);
    if (error > tolerance && t1 - t0 > minSegment) {
      subdivide(t0, v0, tMid, vMid, depth + 1);
      subdivide(tMid, vMid, t1, v1, depth + 1);
    } else {
      addPoint(t0, v0);
    }
  }
  subdivide(0, resolve(0), duration2, resolve(duration2));
  addPoint(duration2, resolve(duration2));
  return points;
}

// node_modules/@remix-run/ui/dist/toggle.js
var TOGGLE_CHANGE_EVENT = "rmx:toggle-change";
var ToggleChangeEvent = class extends Event {
  checked;
  constructor(checked) {
    super(TOGGLE_CHANGE_EVENT, { bubbles: true });
    this.checked = checked;
  }
};
function getBooleanState(value) {
  return value === true || value === false ? value : void 0;
}
function propIsTrue(value) {
  return value === true || value === "true" || value === "";
}
function isDisabled(options, props) {
  return options.disabled === true || propIsTrue(props.disabled) || propIsTrue(props["aria-disabled"]);
}
function isReadOnly(options, props) {
  return options.readOnly === true || propIsTrue(props.readOnly) || propIsTrue(props["aria-readonly"]);
}
var controlMixin = createMixin((handle, hostType) => {
  let uncontrolledChecked = false;
  let hasInitialized = false;
  function getChecked(options, props) {
    let optionChecked = getBooleanState(options.checked);
    if (optionChecked !== void 0) {
      return optionChecked;
    }
    let propChecked = getBooleanState(props.checked);
    if (propChecked !== void 0) {
      return propChecked;
    }
    if (!hasInitialized) {
      uncontrolledChecked = getBooleanState(options.defaultChecked) ?? getBooleanState(props.defaultChecked) ?? false;
      hasInitialized = true;
    }
    return uncontrolledChecked;
  }
  function setChecked(node, options, props, nextChecked) {
    if (isDisabled(options, props) || isReadOnly(options, props)) {
      if (node instanceof HTMLInputElement) {
        node.checked = getChecked(options, props);
      }
      return;
    }
    if (options.checked === void 0 && props.checked === void 0) {
      uncontrolledChecked = nextChecked;
      void handle.update();
    }
    options.onCheckedChange?.(nextChecked);
    node.dispatchEvent(new ToggleChangeEvent(nextChecked));
  }
  return (options = {}, props) => {
    let checked = getChecked(options, props);
    let disabled = isDisabled(options, props);
    let readOnly = isReadOnly(options, props);
    let required2 = options.required ?? props.required;
    let nextProps = {
      ...props,
      "aria-checked": hostType === "input" ? void 0 : checked,
      "aria-disabled": hostType === "input" ? void 0 : disabled || void 0,
      "aria-readonly": hostType === "input" ? void 0 : readOnly || void 0,
      "aria-required": hostType === "input" ? void 0 : required2 || void 0,
      checked: hostType === "input" ? checked : props.checked,
      defaultChecked: hostType === "input" ? void 0 : props.defaultChecked,
      disabled: hostType === "input" ? disabled || void 0 : props.disabled,
      form: hostType === "input" ? options.form ?? props.form : props.form,
      name: hostType === "input" ? options.name ?? props.name : props.name,
      readOnly: hostType === "input" ? readOnly || void 0 : props.readOnly,
      required: hostType === "input" ? required2 : props.required,
      role: "switch",
      tabIndex: hostType === "input" ? options.tabIndex ?? props.tabIndex : disabled ? void 0 : options.tabIndex ?? props.tabIndex ?? 0,
      type: hostType === "input" ? props.type === void 0 ? "checkbox" : props.type : hostType === "button" && props.type === void 0 ? "button" : props.type,
      value: hostType === "input" ? options.value ?? props.value : props.value,
      "data-state": checked ? "checked" : "unchecked"
    };
    return createElement2(handle.element, {
      ...nextProps,
      mix: [
        ref((node, signal) => {
          if (node instanceof HTMLInputElement) {
            options.inputRef?.(node, signal);
          }
        }),
        on("click", (event) => {
          if (hostType !== "input") {
            event.preventDefault();
          }
          if (disabled || readOnly) {
            if (event.currentTarget instanceof HTMLInputElement) {
              event.currentTarget.checked = checked;
            }
            return;
          }
          let nextChecked = event.currentTarget instanceof HTMLInputElement ? event.currentTarget.checked : !checked;
          setChecked(event.currentTarget, options, props, nextChecked);
        }),
        on("keydown", (event) => {
          if (hostType === "input" || event.key !== " ") {
            return;
          }
          event.preventDefault();
          setChecked(event.currentTarget, options, props, !checked);
        })
      ]
    });
  };
});
var control = controlMixin;

// app/lib/overline.ts
var COMBINING_OVERLINE = /(.)[̅̄]+/gu;
function escapeHtml(input) {
  return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function overlineToHtml(input) {
  return escapeHtml(input).replace(COMBINING_OVERLINE, '<span class="ovl">$1</span>');
}

// app/features/challenge/ui/answer-panel.tsx
var panelStyle = css({
  marginTop: "1rem",
  padding: "1rem 1.25rem",
  background: "var(--color-bg-card)",
  border: "1px solid var(--color-border)",
  borderLeft: "3px solid var(--color-accent)",
  borderRadius: "var(--radius-card)"
});
var labelStyle = css({
  fontSize: "0.8rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--color-text-muted)",
  margin: "0 0 0.25rem"
});
var bodyStyle = css({
  "& p": { whiteSpace: "pre-wrap", lineHeight: 1.9, margin: "0 0 0.75rem" }
});
var judgmentRowStyle = css({
  display: "flex",
  gap: "0.75rem",
  margin: "1rem 0 0",
  padding: 0,
  border: 0
});
var judgmentButtonStyle = css({
  width: "3rem",
  height: "3rem",
  borderRadius: "999px",
  border: "1px solid var(--color-border)",
  background: "var(--color-bg-card)",
  fontSize: "1.25rem",
  cursor: "pointer",
  "&:disabled": { cursor: "default", opacity: 0.7 }
});
var correctSelectedStyle = css({
  borderColor: "var(--color-primary)",
  background: "var(--color-primary-soft)",
  color: "var(--color-primary)"
});
var incorrectSelectedStyle = css({
  borderColor: "#b91c1c",
  background: "#fee2e2",
  color: "#7f1d1d"
});
function AnswerPanel(handle) {
  return () => {
    const { question, isOpen, judgment, onJudge } = handle.props;
    if (!isOpen) {
      return null;
    }
    return /* @__PURE__ */ jsx(
      "section",
      {
        id: "exam-answer",
        "aria-labelledby": "exam-answer-heading",
        "aria-live": "polite",
        mix: [panelStyle, animateEntrance({ opacity: 0, ...spring("snappy") })],
        children: /* @__PURE__ */ jsx("div", { mix: bodyStyle, children: [
          /* @__PURE__ */ jsx("h3", { mix: labelStyle, id: "exam-answer-heading", children: "\u89E3\u7B54" }),
          /* @__PURE__ */ jsx("p", { innerHTML: unsafeHTML(overlineToHtml(question.answer)) }),
          question.explanation ? /* @__PURE__ */ jsx(Fragment, { children: [
            /* @__PURE__ */ jsx("p", { mix: labelStyle, children: "\u89E3\u8AAC" }),
            /* @__PURE__ */ jsx("p", { innerHTML: unsafeHTML(overlineToHtml(question.explanation)) })
          ] }) : null,
          /* @__PURE__ */ jsx("fieldset", { mix: judgmentRowStyle, children: [
            /* @__PURE__ */ jsx("legend", { class: "sr-only", children: "\u81EA\u5DF1\u5224\u5B9A" }),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                mix: [
                  judgmentButtonStyle,
                  judgment === "correct" ? correctSelectedStyle : null,
                  control({
                    checked: judgment === "correct",
                    onCheckedChange: () => onJudge("correct"),
                    disabled: judgment !== void 0
                  })
                ],
                "aria-label": "\u6B63\u89E3\u3068\u3057\u3066\u8A18\u9332",
                children: "\u25CB"
              }
            ),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                mix: [
                  judgmentButtonStyle,
                  judgment === "incorrect" ? incorrectSelectedStyle : null,
                  control({
                    checked: judgment === "incorrect",
                    onCheckedChange: () => onJudge("incorrect"),
                    disabled: judgment !== void 0
                  })
                ],
                "aria-label": "\u4E0D\u6B63\u89E3\u3068\u3057\u3066\u8A18\u9332",
                children: "\xD7"
              }
            )
          ] })
        ] })
      }
    );
  };
}

// app/features/challenge/ui/buttons.ts
var primaryButtonStyle = css({
  display: "inline-flex",
  alignItems: "center",
  padding: "0.625rem 1.25rem",
  borderRadius: "var(--radius-control)",
  border: "1px solid var(--color-primary)",
  background: "var(--color-primary)",
  color: "#fff",
  font: "inherit",
  textDecoration: "none",
  cursor: "pointer"
});
var quietButtonStyle = css({
  display: "inline-flex",
  alignItems: "center",
  padding: "0.625rem 1.25rem",
  borderRadius: "var(--radius-control)",
  border: "1px solid var(--color-border)",
  background: "var(--color-bg-card)",
  color: "var(--color-primary)",
  font: "inherit",
  textDecoration: "none",
  cursor: "pointer"
});

// app/features/challenge/ui/challenge-result.tsx
var SUCCESS_THRESHOLD = 0.8;
var sectionStyle = css({
  maxWidth: "36rem",
  margin: "0 auto",
  padding: "1.5rem",
  background: "var(--color-bg-card)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-card)"
});
var eyebrowStyle = css({
  margin: "0 0 0.25rem",
  fontSize: "0.8rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--color-text-muted)"
});
var statsStyle = css({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(8rem, 1fr))",
  gap: "0.75rem",
  margin: "1rem 0",
  "& dt": { fontSize: "0.8rem", color: "var(--color-text-muted)" },
  "& dd": { margin: 0, fontFamily: "var(--font-mono)", fontSize: "1.1rem" }
});
var listStyle = css({
  listStyle: "none",
  margin: "0 0 1rem",
  padding: 0,
  "& li": {
    display: "flex",
    justifyContent: "space-between",
    gap: "0.75rem",
    padding: "0.375rem 0",
    borderBottom: "1px solid var(--color-border)"
  }
});
var actionsStyle = css({
  display: "flex",
  gap: "0.75rem",
  flexWrap: "wrap"
});
var primaryButtonStyle2 = css({
  padding: "0.625rem 1.25rem",
  borderRadius: "var(--radius-control)",
  border: "1px solid var(--color-primary)",
  background: "var(--color-primary)",
  color: "#fff",
  font: "inherit",
  cursor: "pointer"
});
var quietLinkStyle = css({
  display: "inline-flex",
  alignItems: "center",
  padding: "0.625rem 1.25rem",
  borderRadius: "var(--radius-control)",
  border: "1px solid var(--color-border)",
  color: "var(--color-primary)",
  textDecoration: "none"
});
function ChallengeResultView(handle) {
  return () => {
    const { payload, history, questions, mode, unitId, year, syncMessage, onRetry } = handle.props;
    const summary = summarizeChallenge(payload);
    const aggregate = aggregateChallengeResults(history);
    const questionById = new Map(questions.map((question) => [question.id, question]));
    const accuracy = mode === "exam" ? aggregate.accuracy : summary.accuracy;
    const isSuccess = accuracy !== null && accuracy >= SUCCESS_THRESHOLD;
    return /* @__PURE__ */ jsx("section", { "aria-labelledby": "exam-result-title", mix: sectionStyle, children: [
      /* @__PURE__ */ jsx("p", { mix: eyebrowStyle, children: "\u7D50\u679C" }),
      /* @__PURE__ */ jsx("h2", { id: "exam-result-title", children: isSuccess ? "\u3088\u304F\u3067\u304D\u307E\u3057\u305F" : "\u304A\u3064\u304B\u308C\u3055\u307E\u3067\u3057\u305F" }),
      /* @__PURE__ */ jsx("dl", { mix: statsStyle, children: [
        /* @__PURE__ */ jsx("div", { children: [
          /* @__PURE__ */ jsx("dt", { children: "\u6B63\u7B54\u7387" }),
          /* @__PURE__ */ jsx("dd", { children: formatAccuracy(accuracy) })
        ] }),
        /* @__PURE__ */ jsx("div", { children: [
          /* @__PURE__ */ jsx("dt", { children: "\u6B63\u89E3" }),
          /* @__PURE__ */ jsx("dd", { children: summary.correctCount })
        ] }),
        /* @__PURE__ */ jsx("div", { children: [
          /* @__PURE__ */ jsx("dt", { children: "\u4E0D\u6B63\u89E3" }),
          /* @__PURE__ */ jsx("dd", { children: summary.incorrectCount })
        ] }),
        /* @__PURE__ */ jsx("div", { children: [
          /* @__PURE__ */ jsx("dt", { children: "\u5408\u8A08\u6642\u9593" }),
          /* @__PURE__ */ jsx("dd", { children: formatDuration(summary.totalElapsedMs) })
        ] }),
        mode === "exam" && aggregate.challengeCount > 1 ? /* @__PURE__ */ jsx("div", { children: [
          /* @__PURE__ */ jsx("dt", { children: "\u3053\u308C\u307E\u3067\u306E\u8A66\u884C" }),
          /* @__PURE__ */ jsx("dd", { children: [
            aggregate.challengeCount,
            "\u56DE"
          ] })
        ] }) : null
      ] }),
      /* @__PURE__ */ jsx("ol", { mix: listStyle, children: payload.answers.map((answer) => {
        const question = questionById.get(answer.questionId);
        return /* @__PURE__ */ jsx("li", { children: [
          /* @__PURE__ */ jsx("span", { children: question ? `\u554F${question.number}` : answer.questionId }),
          /* @__PURE__ */ jsx("span", { children: answer.judgment === "correct" ? "\u25CB" : "\xD7" }),
          /* @__PURE__ */ jsx("span", { children: formatDuration(answer.elapsedMs) })
        ] }, answer.questionId);
      }) }),
      syncMessage ? /* @__PURE__ */ jsx("p", { role: "status", children: syncMessage }) : null,
      /* @__PURE__ */ jsx("div", { mix: actionsStyle, children: [
        /* @__PURE__ */ jsx("button", { type: "button", mix: [primaryButtonStyle2, on("click", onRetry)], children: "\u3082\u3046\u4E00\u5EA6\u6311\u6226\u3059\u308B" }),
        /* @__PURE__ */ jsx("a", { mix: quietLinkStyle, href: `/${unitId}/${year}`, children: "\u554F\u984C\u4E00\u89A7\u3078\u623B\u308B" })
      ] })
    ] });
  };
}

// app/ui/icons.tsx
function icon(children) {
  return function Icon(handle) {
    void handle;
    return () => /* @__PURE__ */ jsx(
      "svg",
      {
        width: "16",
        height: "16",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "2",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        "aria-hidden": "true",
        children: children()
      }
    );
  };
}
var MenuIcon = icon(() => /* @__PURE__ */ jsx("path", { d: "M4 6h16M4 12h16M4 18h16" }));
var CloseIcon = icon(() => /* @__PURE__ */ jsx("path", { d: "m6 6 12 12M18 6 6 18" }));
var ChevronLeftIcon = icon(() => /* @__PURE__ */ jsx("path", { d: "m15 18-6-6 6-6" }));
var ChevronRightIcon = icon(() => /* @__PURE__ */ jsx("path", { d: "m9 18 6-6-6-6" }));
var CheckIcon = icon(() => /* @__PURE__ */ jsx("polyline", { points: "20 6 9 17 4 12" }));
var PauseIcon = icon(() => /* @__PURE__ */ jsx("path", { d: "M9 5v14M15 5v14" }));
var TimerIcon = icon(() => /* @__PURE__ */ jsx(Fragment, { children: [
  /* @__PURE__ */ jsx("circle", { cx: "12", cy: "13", r: "8" }),
  /* @__PURE__ */ jsx("path", { d: "M12 9v4l2.5 1.5M10 2h4m-2 0v3M19 6l-1.5 1.5" })
] }));
var AnswerSheetIcon = icon(() => /* @__PURE__ */ jsx(Fragment, { children: [
  /* @__PURE__ */ jsx("path", { d: "M7 3.5h7l4.5 4.5v12.5H7z" }),
  /* @__PURE__ */ jsx("path", { d: "M14 3.5V8h4.5M9.5 14l2 2 4-4" })
] }));

// app/features/challenge/ui/player-controls.tsx
var actionStyle = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "2.25rem",
  height: "2.25rem",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-control)",
  background: "var(--color-bg-card)",
  color: "var(--color-primary)",
  cursor: "pointer",
  "&:hover": { background: "var(--color-primary-soft)" },
  "&:disabled": { cursor: "default", opacity: 0.5 }
});
var actionsRowStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  border: 0,
  margin: "0.75rem 0 0",
  padding: 0
});
var timersStyle = css({
  display: "flex",
  gap: "1rem",
  margin: "0.75rem 0 0",
  border: 0,
  padding: 0,
  "& div": { display: "flex", alignItems: "baseline", gap: "0.375rem" },
  "& span": { fontSize: "0.8rem", color: "var(--color-text-muted)" },
  "& strong": { fontFamily: "var(--font-mono)", fontSize: "1rem" }
});
var edgeNavStyle = css({
  display: "flex",
  justifyContent: "space-between",
  marginTop: "1rem"
});
function QuestionActions(handle) {
  return () => {
    const { copyText, answerOpen, onToggleAnswer, timerRunning, onToggleTimer } = handle.props;
    return /* @__PURE__ */ jsx("fieldset", { mix: actionsRowStyle, children: [
      /* @__PURE__ */ jsx("legend", { class: "sr-only", children: "\u554F\u984C\u306E\u64CD\u4F5C" }),
      /* @__PURE__ */ jsx(CopyButton, { text: copyText, label: "\u554F\u984C\u6587\u3092\u30B3\u30D4\u30FC" }),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          mix: [actionStyle, on("click", onToggleAnswer)],
          "aria-label": answerOpen ? "\u89E3\u7B54\u3092\u96A0\u3059" : "\u89E3\u7B54\u3092\u8868\u793A",
          title: answerOpen ? "\u89E3\u7B54\u3092\u96A0\u3059" : "\u89E3\u7B54\u3092\u8868\u793A",
          "aria-expanded": answerOpen ? "true" : "false",
          "aria-controls": answerOpen ? "exam-answer" : void 0,
          children: answerOpen ? /* @__PURE__ */ jsx(CloseIcon, {}) : /* @__PURE__ */ jsx(AnswerSheetIcon, {})
        }
      ),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          mix: [actionStyle, on("click", onToggleTimer)],
          "aria-label": timerRunning ? "\u8A08\u6E2C\u3092\u4E00\u6642\u505C\u6B62" : "\u8A08\u6E2C\u3092\u518D\u958B",
          title: timerRunning ? "\u8A08\u6E2C\u3092\u4E00\u6642\u505C\u6B62" : "\u8A08\u6E2C\u3092\u518D\u958B",
          "aria-pressed": timerRunning ? "true" : "false",
          style: timerRunning ? { borderColor: "var(--color-accent)" } : void 0,
          children: timerRunning ? /* @__PURE__ */ jsx(PauseIcon, {}) : /* @__PURE__ */ jsx(TimerIcon, {})
        }
      )
    ] });
  };
}
function ChallengeTimerDisplay(handle) {
  let now = 0;
  let interval;
  const stopTicking = () => {
    if (interval !== void 0) {
      clearInterval(interval);
      interval = void 0;
    }
  };
  const syncTicking = (running) => {
    if (!running) {
      stopTicking();
      return;
    }
    if (interval === void 0) {
      now = typeof performance === "undefined" ? 0 : performance.now();
      interval = setInterval(() => {
        now = performance.now();
        void handle.update();
      }, 1e3);
    }
  };
  return () => {
    const { mode, totalElapsedMs, questionElapsedMs, timerRunning, timerStartedAt } = handle.props;
    const displayedTotalMs = projectElapsedTime(totalElapsedMs, timerRunning, timerStartedAt, now);
    const displayedQuestionMs = projectElapsedTime(
      questionElapsedMs,
      timerRunning,
      timerStartedAt,
      now
    );
    return /* @__PURE__ */ jsx(
      "fieldset",
      {
        mix: [
          timersStyle,
          ref((node) => {
            if (node) {
              syncTicking(timerRunning);
            } else {
              stopTicking();
            }
          })
        ],
        children: [
          /* @__PURE__ */ jsx("legend", { class: "sr-only", children: "\u7D4C\u904E\u6642\u9593" }),
          mode === "exam" ? /* @__PURE__ */ jsx("div", { children: [
            /* @__PURE__ */ jsx("span", { children: "\u5168\u4F53" }),
            /* @__PURE__ */ jsx("strong", { "data-testid": "challenge-total-time", "aria-live": "off", children: formatDuration(displayedTotalMs) })
          ] }) : null,
          /* @__PURE__ */ jsx("div", { children: [
            /* @__PURE__ */ jsx("span", { children: mode === "question" ? "\u8A08\u6E2C\u6642\u9593" : "\u3053\u306E\u554F\u984C" }),
            /* @__PURE__ */ jsx("strong", { "data-testid": "challenge-question-time", "aria-live": "off", children: formatDuration(displayedQuestionMs) })
          ] })
        ]
      }
    );
  };
}
function PlayerEdgeNavigation(handle) {
  return () => {
    const { showPrevious, isFirst, isLast, canFinish, onPrevious, onNext, onFinish } = handle.props;
    if (!(showPrevious || isLast)) {
      return null;
    }
    return /* @__PURE__ */ jsx("nav", { "aria-label": "\u554F\u984C\u79FB\u52D5", mix: edgeNavStyle, children: [
      showPrevious ? /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          mix: [actionStyle, on("click", onPrevious)],
          "aria-label": "\u524D\u306E\u554F\u984C",
          title: "\u524D\u306E\u554F\u984C",
          disabled: isFirst,
          children: /* @__PURE__ */ jsx(ChevronLeftIcon, {})
        }
      ) : /* @__PURE__ */ jsx("span", {}),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          mix: [actionStyle, on("click", isLast ? onFinish : onNext)],
          "aria-label": isLast ? "\u7D50\u679C\u3092\u898B\u308B" : "\u6B21\u306E\u554F\u984C",
          title: isLast ? "\u7D50\u679C\u3092\u898B\u308B" : "\u6B21\u306E\u554F\u984C",
          disabled: isLast && !canFinish,
          children: isLast ? /* @__PURE__ */ jsx(CheckIcon, {}) : /* @__PURE__ */ jsx(ChevronRightIcon, {})
        }
      )
    ] });
  };
}

// app/features/challenge/ui/player-header.tsx
var headerStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: "0.75rem",
  padding: "0.75rem 1rem",
  background: "var(--color-bg-card)",
  borderBottom: "1px solid var(--color-border)"
});
var identityStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  minWidth: 0,
  "& h2": {
    margin: 0,
    fontFamily: "var(--font-serif)",
    fontSize: "1.05rem",
    fontWeight: 700,
    color: "var(--color-primary)"
  }
});
var progressStyle = css({ flex: "1 1 16rem", minWidth: 0 });
var stepsStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  "& ol": {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.25rem",
    listStyle: "none",
    margin: 0,
    padding: 0
  }
});
var stepButtonStyle = css({
  width: "1.75rem",
  height: "1.75rem",
  border: "1px solid var(--color-border)",
  borderRadius: "999px",
  background: "var(--color-bg)",
  color: "var(--color-text-muted)",
  font: "inherit",
  fontSize: "0.8rem",
  cursor: "pointer",
  "&:disabled": { cursor: "default", opacity: 0.6 }
});
var stepCurrentStyle = css({
  background: "var(--color-primary)",
  borderColor: "var(--color-primary)",
  color: "#fff",
  fontWeight: 700
});
var trackStyle = css({
  flex: 1,
  height: "0.375rem",
  borderRadius: "999px",
  background: "var(--color-primary-soft)",
  overflow: "hidden",
  "& > span": {
    display: "block",
    height: "100%",
    background: "var(--color-accent)",
    transition: "width 150ms ease"
  }
});
function PlayerHeader(handle) {
  return () => {
    const {
      playerTitle,
      questions,
      currentQuestionIndex,
      onOpenQuestionList,
      onSelectQuestion,
      disabled = false
    } = handle.props;
    const ratio = questions.length > 0 ? (currentQuestionIndex + 1) / questions.length : 0;
    return /* @__PURE__ */ jsx("header", { mix: headerStyle, children: [
      /* @__PURE__ */ jsx("div", { mix: identityStyle, children: [
        questions.length > 1 ? /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            mix: on("click", onOpenQuestionList),
            "aria-label": "\u554F\u984C\u4E00\u89A7\u3092\u958B\u304F",
            title: "\u554F\u984C\u4E00\u89A7\u3092\u958B\u304F",
            disabled,
            children: /* @__PURE__ */ jsx(MenuIcon, {})
          }
        ) : null,
        /* @__PURE__ */ jsx("h2", { children: playerTitle })
      ] }),
      /* @__PURE__ */ jsx("nav", { "aria-label": "\u554F\u984C\u756A\u53F7", mix: progressStyle, children: /* @__PURE__ */ jsx("div", { mix: stepsStyle, children: [
        /* @__PURE__ */ jsx("ol", { children: questions.map((question, index) => /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            "aria-label": `\u554F${index + 1}`,
            "aria-current": index === currentQuestionIndex ? "step" : void 0,
            mix: [
              stepButtonStyle,
              index === currentQuestionIndex ? stepCurrentStyle : null,
              on("click", () => onSelectQuestion(index))
            ],
            disabled,
            children: index + 1
          }
        ) }, question.id)) }),
        /* @__PURE__ */ jsx(
          "div",
          {
            mix: trackStyle,
            role: "progressbar",
            "aria-label": "\u554F\u984C\u306E\u9032\u6357",
            "aria-valuemin": 0,
            "aria-valuemax": questions.length,
            "aria-valuenow": currentQuestionIndex + 1,
            "aria-valuetext": `\u554F${currentQuestionIndex + 1} / ${questions.length}`,
            children: /* @__PURE__ */ jsx("span", { style: { width: `${ratio * 100}%` } })
          }
        )
      ] }) })
    ] });
  };
}

// node_modules/@remix-run/ui/dist/anchor.js
var viewportPaddingPx = 16;
function isHorizontalPlacement(placement) {
  return placement.startsWith("left") || placement.startsWith("right");
}
function isVerticalPlacement(placement) {
  return placement.startsWith("top") || placement.startsWith("bottom");
}
function constrainToAxis(desiredPosition, elementSize, minBound, maxBound) {
  let elementEnd = desiredPosition + elementSize;
  if (elementEnd > maxBound) {
    desiredPosition -= elementEnd - maxBound;
  }
  if (desiredPosition < minBound) {
    desiredPosition = minBound;
  }
  return desiredPosition;
}
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
function getConstrainedPositionRange(elementSize, minBound, maxBound) {
  return {
    min: minBound,
    max: Math.max(minBound, maxBound - elementSize)
  };
}
function getOffScreenStatus(anchorRect, axis) {
  if (axis === "horizontal") {
    if (anchorRect.right <= 0)
      return "before";
    if (anchorRect.left >= window.innerWidth)
      return "after";
    return "visible";
  }
  if (anchorRect.bottom <= 0)
    return "before";
  if (anchorRect.top >= window.innerHeight)
    return "after";
  return "visible";
}
function applyOffset(position, placement, offset, offsetX = 0, offsetY = 0) {
  if (offset === 0 && offsetX === 0 && offsetY === 0) {
    return position;
  }
  let { top, left } = position;
  if (placement.startsWith("top")) {
    top -= offset;
  } else if (placement.startsWith("bottom")) {
    top += offset;
  } else if (placement.startsWith("left")) {
    left -= offset;
  } else if (placement.startsWith("right")) {
    left += offset;
  }
  left += offsetX;
  top += offsetY;
  return { top, left };
}
function resolveOffsetValue(offset, floating) {
  if (typeof offset === "function") {
    return offset(floating);
  }
  return offset ?? 0;
}
function isAnchorPoint(value) {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if (!("x" in value) || !("y" in value)) {
    return false;
  }
  let width = "width" in value ? value.width : void 0;
  let height = "height" in value ? value.height : void 0;
  return typeof value.x === "number" && typeof value.y === "number" && (width === void 0 || typeof width === "number") && (height === void 0 || typeof height === "number");
}
function readAnchorRect(anchorTarget) {
  if (anchorTarget instanceof HTMLElement) {
    return anchorTarget.getBoundingClientRect();
  }
  return new DOMRect(anchorTarget.x, anchorTarget.y, anchorTarget.width ?? 0, anchorTarget.height ?? 0);
}
function calculatePosition(placement, anchorRect, floatingWidth, floatingHeight, inset = false) {
  let top = anchorRect.bottom;
  let left = anchorRect.left + (anchorRect.width - floatingWidth) / 2;
  if (placement === "bottom-start") {
    left = anchorRect.left;
  } else if (placement === "bottom-end") {
    left = anchorRect.right - floatingWidth;
  } else if (placement === "top") {
    top = anchorRect.top - floatingHeight;
  } else if (placement === "top-start") {
    top = anchorRect.top - floatingHeight;
    left = anchorRect.left;
  } else if (placement === "top-end") {
    top = anchorRect.top - floatingHeight;
    left = anchorRect.right - floatingWidth;
  } else if (placement === "left") {
    top = anchorRect.top + (anchorRect.height - floatingHeight) / 2;
    left = anchorRect.left - floatingWidth;
  } else if (placement === "left-start") {
    top = anchorRect.top;
    left = anchorRect.left - floatingWidth;
  } else if (placement === "left-end") {
    top = anchorRect.bottom - floatingHeight;
    left = anchorRect.left - floatingWidth;
  } else if (placement === "right") {
    top = anchorRect.top + (anchorRect.height - floatingHeight) / 2;
    left = anchorRect.right;
  } else if (placement === "right-start") {
    top = anchorRect.top;
    left = anchorRect.right;
  } else if (placement === "right-end") {
    top = anchorRect.bottom - floatingHeight;
    left = anchorRect.right;
  }
  if (inset) {
    if (placement.startsWith("bottom")) {
      top = anchorRect.bottom - floatingHeight;
    } else if (placement.startsWith("top")) {
      top = anchorRect.top;
    } else if (placement.startsWith("left")) {
      left = anchorRect.left;
    } else if (placement.startsWith("right")) {
      left = anchorRect.right - floatingWidth;
    }
  }
  return { top, left };
}
function isScrollableOverflow(value) {
  return value === "auto" || value === "scroll" || value === "overlay";
}
function getRelativeScrollContainer(floating, relativeElement) {
  let current = relativeElement.parentElement;
  while (current && current !== floating) {
    let style = getComputedStyle(current);
    if (isScrollableOverflow(style.overflowX) || isScrollableOverflow(style.overflowY)) {
      return current;
    }
    current = current.parentElement;
  }
  return floating;
}
function readFloatingDimensions(floating, relativeTo) {
  let relativeElement = relativeTo ? floating.querySelector(relativeTo) : null;
  if (relativeElement && !(relativeElement instanceof HTMLElement)) {
    relativeElement = null;
  }
  let scrollContainer = relativeElement ? getRelativeScrollContainer(floating, relativeElement) : floating;
  let relativeOffsetX = null;
  let relativeOffsetY = null;
  let scrollContainerOffsetX = 0;
  let scrollContainerOffsetY = 0;
  if (relativeElement instanceof HTMLElement) {
    let floatingRect = floating.getBoundingClientRect();
    let scrollContainerRect = scrollContainer.getBoundingClientRect();
    let relativeRect = relativeElement.getBoundingClientRect();
    scrollContainerOffsetX = scrollContainerRect.left - floatingRect.left;
    scrollContainerOffsetY = scrollContainerRect.top - floatingRect.top;
    relativeOffsetX = relativeRect.left - scrollContainerRect.left + scrollContainer.scrollLeft;
    relativeOffsetY = relativeRect.top - scrollContainerRect.top + scrollContainer.scrollTop;
  }
  return {
    width: floating.offsetWidth,
    height: floating.offsetHeight,
    scrollContainer,
    scrollContainerOffsetX,
    scrollContainerOffsetY,
    scrollViewportWidth: scrollContainer.offsetWidth,
    scrollViewportHeight: scrollContainer.offsetHeight,
    scrollWidth: Math.max(scrollContainer.scrollWidth, scrollContainer.offsetWidth),
    scrollHeight: Math.max(scrollContainer.scrollHeight, scrollContainer.offsetHeight),
    relativeWidth: relativeElement instanceof HTMLElement ? relativeElement.offsetWidth : null,
    relativeHeight: relativeElement instanceof HTMLElement ? relativeElement.offsetHeight : null,
    relativeElement,
    relativeOffsetX,
    relativeOffsetY
  };
}
function getFloatingDimensions(floating, relativeTo, { ignoreInlineMaxSize = false } = {}) {
  let originalPosition = floating.style.position;
  let originalLeft = floating.style.left;
  let originalDisplay = floating.style.display;
  let originalMaxWidth = floating.style.maxWidth;
  let originalMaxHeight = floating.style.maxHeight;
  if (ignoreInlineMaxSize) {
    floating.style.maxWidth = "";
    floating.style.maxHeight = "";
  }
  let needsTemporaryLayout = floating.offsetWidth === 0;
  if (needsTemporaryLayout) {
    floating.style.position = "absolute";
    floating.style.left = "-9999px";
    floating.style.display = "block";
  }
  let dimensions = readFloatingDimensions(floating, relativeTo);
  if (needsTemporaryLayout) {
    floating.style.position = originalPosition;
    floating.style.left = originalLeft;
    floating.style.display = originalDisplay;
  }
  if (ignoreInlineMaxSize) {
    floating.style.maxWidth = originalMaxWidth;
    floating.style.maxHeight = originalMaxHeight;
  }
  return dimensions;
}
function getClientViewportBounds(padding = 0) {
  return {
    left: padding,
    top: padding,
    right: window.innerWidth - padding,
    bottom: window.innerHeight - padding
  };
}
function getDocumentViewportBounds(isFixed, padding = 0) {
  if (isFixed) {
    return getClientViewportBounds(padding);
  }
  return {
    left: window.scrollX + padding,
    top: window.scrollY + padding,
    right: window.scrollX + window.innerWidth - padding,
    bottom: window.scrollY + window.innerHeight - padding
  };
}
function getOverflowAmount(bounds, viewport) {
  return Math.max(viewport.left - bounds.left, 0) + Math.max(bounds.right - viewport.right, 0) + Math.max(viewport.top - bounds.top, 0) + Math.max(bounds.bottom - viewport.bottom, 0);
}
function hasRectChanged(currentRect, previousRect) {
  return Math.abs(currentRect.top - previousRect.top) >= 1 || Math.abs(currentRect.left - previousRect.left) >= 1 || Math.abs(currentRect.right - previousRect.right) >= 1 || Math.abs(currentRect.bottom - previousRect.bottom) >= 1;
}
function hasNullableNumberChanged(current, previous) {
  if (current === null || previous === null) {
    return current !== previous;
  }
  return Math.abs(current - previous) >= 1;
}
function hasFloatingDimensionsChanged(currentDimensions, previousDimensions) {
  return Math.abs(currentDimensions.width - previousDimensions.width) >= 1 || Math.abs(currentDimensions.height - previousDimensions.height) >= 1 || Math.abs(currentDimensions.scrollViewportWidth - previousDimensions.scrollViewportWidth) >= 1 || Math.abs(currentDimensions.scrollViewportHeight - previousDimensions.scrollViewportHeight) >= 1 || Math.abs(currentDimensions.scrollWidth - previousDimensions.scrollWidth) >= 1 || Math.abs(currentDimensions.scrollHeight - previousDimensions.scrollHeight) >= 1 || Math.abs(currentDimensions.scrollContainerOffsetX - previousDimensions.scrollContainerOffsetX) >= 1 || Math.abs(currentDimensions.scrollContainerOffsetY - previousDimensions.scrollContainerOffsetY) >= 1 || hasNullableNumberChanged(currentDimensions.relativeWidth, previousDimensions.relativeWidth) || hasNullableNumberChanged(currentDimensions.relativeHeight, previousDimensions.relativeHeight) || hasNullableNumberChanged(currentDimensions.relativeOffsetX, previousDimensions.relativeOffsetX) || hasNullableNumberChanged(currentDimensions.relativeOffsetY, previousDimensions.relativeOffsetY);
}
function getOppositePlacement(placement) {
  let opposites = {
    top: "bottom",
    "top-start": "bottom-start",
    "top-end": "bottom-end",
    bottom: "top",
    "bottom-start": "top-start",
    "bottom-end": "top-end",
    left: "right",
    "left-start": "right-start",
    "left-end": "right-end",
    right: "left",
    "right-start": "left-start",
    "right-end": "left-end"
  };
  return opposites[placement];
}
function calculateFloatingBounds(placement, anchorRect, placementWidth, placementHeight, collisionWidth, collisionHeight, inset, offset, offsetX, offsetY, relativeOffsetX, relativeOffsetY) {
  let position = calculatePosition(placement, anchorRect, placementWidth, placementHeight, inset);
  position = applyOffset(position, placement, offset, offsetX, offsetY);
  if (relativeOffsetX !== null && relativeOffsetX !== void 0) {
    position.left -= relativeOffsetX;
  }
  if (relativeOffsetY !== null && relativeOffsetY !== void 0) {
    position.top -= relativeOffsetY;
  }
  return {
    top: position.top,
    left: position.left,
    right: position.left + collisionWidth,
    bottom: position.top + collisionHeight
  };
}
function getPlacementScore(placement, anchorRect, placementWidth, placementHeight, collisionWidth, collisionHeight, inset, offset, offsetX, offsetY, relativeOffsetX, relativeOffsetY) {
  let viewport = getClientViewportBounds(viewportPaddingPx);
  let bounds = calculateFloatingBounds(placement, anchorRect, placementWidth, placementHeight, collisionWidth, collisionHeight, inset, offset, offsetX, offsetY, relativeOffsetX, relativeOffsetY);
  let constraints = {
    leftOk: bounds.left >= viewport.left,
    rightOk: bounds.right <= viewport.right,
    topOk: bounds.top >= viewport.top,
    bottomOk: bounds.bottom <= viewport.bottom
  };
  let total = Object.values(constraints).filter(Boolean).length;
  return {
    overflow: getOverflowAmount(bounds, viewport),
    total,
    perfect: total === 4
  };
}
function getFlippedPlacement(placement, anchorRect, placementWidth, placementHeight, collisionWidth, collisionHeight, anchorIsAbsolutePositioned, inset, offset, offsetX, offsetY, relativeOffsetX, relativeOffsetY) {
  let hasScroll = window.scrollY > 0;
  if (placement.startsWith("top") && anchorIsAbsolutePositioned && hasScroll) {
    if (anchorRect.top - placementHeight < 0) {
      return placement;
    }
  }
  let original = getPlacementScore(placement, anchorRect, placementWidth, placementHeight, collisionWidth, collisionHeight, inset, offset, offsetX, offsetY, relativeOffsetX, relativeOffsetY);
  if (original.perfect) {
    return placement;
  }
  let flippedPlacement = getOppositePlacement(placement);
  let flipped = getPlacementScore(flippedPlacement, anchorRect, placementWidth, placementHeight, collisionWidth, collisionHeight, inset, offset, offsetX, offsetY, relativeOffsetX, relativeOffsetY);
  if (flipped.perfect || flipped.total > original.total || flipped.total === original.total && flipped.overflow < original.overflow) {
    return flippedPlacement;
  }
  return placement;
}
function getAvailableWidthForPlacement(placement, left, width, viewport) {
  if (placement.startsWith("left")) {
    return left + width - viewport.left;
  }
  if (placement.startsWith("right")) {
    return viewport.right - left;
  }
  return viewport.right - viewport.left;
}
function getAvailableHeightForPlacement(placement, top, height, viewport) {
  if (placement.startsWith("top")) {
    return top + height - viewport.top;
  }
  if (placement.startsWith("bottom")) {
    return viewport.bottom - top;
  }
  return viewport.bottom - viewport.top;
}
function calculateDocumentPosition(placement, anchorRect, placementWidth, placementHeight, inset, offset, offsetX, offsetY, isFixed, scrollContainerOffsetX = 0, scrollContainerOffsetY = 0, relativeOffsetX, relativeOffsetY) {
  let position = calculatePosition(placement, anchorRect, placementWidth, placementHeight, inset);
  if (!isFixed) {
    position.top += window.scrollY;
    position.left += window.scrollX;
  }
  position = applyOffset(position, placement, offset, offsetX, offsetY);
  position.left -= scrollContainerOffsetX;
  position.top -= scrollContainerOffsetY;
  if (relativeOffsetX !== null && relativeOffsetX !== void 0) {
    position.left -= relativeOffsetX;
  }
  if (relativeOffsetY !== null && relativeOffsetY !== void 0) {
    position.top -= relativeOffsetY;
  }
  return position;
}
function solveRelativeAlignmentAxis(options) {
  let maxScroll = Math.max(options.naturalSize - options.visibleSize, 0);
  let scroll = clamp(options.currentScroll, 0, maxScroll);
  if (maxScroll === 0) {
    return {
      position: clamp(options.desiredPosition, options.minPosition, options.maxPosition),
      scroll
    };
  }
  let exactScrollMin = Math.max(0, options.minPosition - options.desiredPosition);
  let exactScrollMax = Math.min(maxScroll, options.maxPosition - options.desiredPosition);
  if (exactScrollMin <= exactScrollMax) {
    scroll = clamp(scroll, exactScrollMin, exactScrollMax);
  } else if (options.desiredPosition > options.maxPosition) {
    scroll = 0;
  } else if (options.desiredPosition + maxScroll < options.minPosition) {
    scroll = maxScroll;
  }
  return {
    position: clamp(options.desiredPosition + scroll, options.minPosition, options.maxPosition),
    scroll
  };
}
function anchor(floating, anchorTarget, options = {}) {
  let lastAnchorRect;
  let lastFloatingDimensions;
  if (!(floating instanceof HTMLElement)) {
    throw new TypeError("anchor() expected a floating HTMLElement");
  }
  if (!(anchorTarget instanceof HTMLElement) && !isAnchorPoint(anchorTarget)) {
    throw new TypeError("anchor() expected an anchor HTMLElement or coordinates");
  }
  let { placement = "bottom", inset = false, relativeTo, offset: rawOffset = 0, offsetX: rawOffsetX = 0, offsetY: rawOffsetY = 0 } = options;
  let anchorIsAbsolutePositioned = anchorTarget instanceof HTMLElement && getComputedStyle(anchorTarget).position !== "fixed";
  let isFixed = floating.hasAttribute("popover") || !anchorIsAbsolutePositioned;
  let animationFrameId = 0;
  function updatePosition(anchorRect = readAnchorRect(anchorTarget), naturalDimensions = getFloatingDimensions(floating, relativeTo, {
    ignoreInlineMaxSize: true
  })) {
    let offset = resolveOffsetValue(rawOffset, floating);
    let offsetX = resolveOffsetValue(rawOffsetX, floating);
    let offsetY = resolveOffsetValue(rawOffsetY, floating);
    let viewport = getDocumentViewportBounds(isFixed, viewportPaddingPx);
    let placementWidth = relativeTo && naturalDimensions.relativeWidth ? naturalDimensions.relativeWidth : naturalDimensions.width;
    let placementHeight = relativeTo && naturalDimensions.relativeHeight ? naturalDimensions.relativeHeight : naturalDimensions.height;
    let finalPlacement = getFlippedPlacement(placement, anchorRect, placementWidth, placementHeight, naturalDimensions.width, naturalDimensions.height, anchorIsAbsolutePositioned, inset, offset, offsetX, offsetY, naturalDimensions.relativeOffsetX, naturalDimensions.relativeOffsetY);
    floating.setAttribute("data-anchor-placement", finalPlacement);
    let position = calculateDocumentPosition(finalPlacement, anchorRect, placementWidth, placementHeight, inset, offset, offsetX, offsetY, isFixed, naturalDimensions.scrollContainerOffsetX, naturalDimensions.scrollContainerOffsetY, naturalDimensions.relativeOffsetX, naturalDimensions.relativeOffsetY);
    let availableWidth = Math.max(getAvailableWidthForPlacement(finalPlacement, position.left, naturalDimensions.width, viewport), 0);
    let availableHeight = Math.max(getAvailableHeightForPlacement(finalPlacement, position.top, naturalDimensions.height, viewport), 0);
    floating.style.maxWidth = availableWidth < naturalDimensions.width ? `${Math.floor(availableWidth)}px` : "";
    floating.style.maxHeight = availableHeight < naturalDimensions.height ? `${Math.floor(availableHeight)}px` : "";
    let dimensions = getFloatingDimensions(floating, relativeTo);
    placementWidth = relativeTo && dimensions.relativeWidth ? dimensions.relativeWidth : dimensions.width;
    placementHeight = relativeTo && dimensions.relativeHeight ? dimensions.relativeHeight : dimensions.height;
    position = calculateDocumentPosition(finalPlacement, anchorRect, placementWidth, placementHeight, inset, offset, offsetX, offsetY, isFixed, dimensions.scrollContainerOffsetX, dimensions.scrollContainerOffsetY, dimensions.relativeOffsetX, dimensions.relativeOffsetY);
    let minX = viewport.left;
    let minY = viewport.top;
    let maxX = viewport.right;
    let maxY = viewport.bottom;
    let xRange = getConstrainedPositionRange(dimensions.width, minX, maxX);
    let yRange = getConstrainedPositionRange(dimensions.height, minY, maxY);
    if (isHorizontalPlacement(finalPlacement)) {
      if (relativeTo && dimensions.relativeOffsetY !== null) {
        let solvedY = solveRelativeAlignmentAxis({
          currentScroll: dimensions.scrollContainer.scrollTop,
          desiredPosition: position.top,
          naturalSize: dimensions.scrollHeight,
          visibleSize: dimensions.scrollViewportHeight,
          minPosition: yRange.min,
          maxPosition: yRange.max
        });
        dimensions.scrollContainer.scrollTop = solvedY.scroll;
        position.top = solvedY.position;
      } else {
        position.top = constrainToAxis(position.top, dimensions.height, minY, maxY);
      }
      if (relativeTo) {
        if (dimensions.relativeOffsetX !== null) {
          let solvedX = solveRelativeAlignmentAxis({
            currentScroll: dimensions.scrollContainer.scrollLeft,
            desiredPosition: position.left,
            naturalSize: dimensions.scrollWidth,
            visibleSize: dimensions.scrollViewportWidth,
            minPosition: xRange.min,
            maxPosition: xRange.max
          });
          dimensions.scrollContainer.scrollLeft = solvedX.scroll;
          position.left = solvedX.position;
        } else {
          position.left = clamp(position.left, xRange.min, xRange.max);
        }
      }
    } else if (isVerticalPlacement(finalPlacement)) {
      if (relativeTo && dimensions.relativeOffsetX !== null) {
        let solvedX = solveRelativeAlignmentAxis({
          currentScroll: dimensions.scrollContainer.scrollLeft,
          desiredPosition: position.left,
          naturalSize: dimensions.scrollWidth,
          visibleSize: dimensions.scrollViewportWidth,
          minPosition: xRange.min,
          maxPosition: xRange.max
        });
        dimensions.scrollContainer.scrollLeft = solvedX.scroll;
        position.left = solvedX.position;
      } else {
        position.left = constrainToAxis(position.left, dimensions.width, minX, maxX);
      }
      if (!isFixed && window.scrollY > 0 && position.top < viewport.top) {
        position.top = viewport.top;
      }
      if (relativeTo) {
        if (dimensions.relativeOffsetY !== null) {
          let solvedY = solveRelativeAlignmentAxis({
            currentScroll: dimensions.scrollContainer.scrollTop,
            desiredPosition: position.top,
            naturalSize: dimensions.scrollHeight,
            visibleSize: dimensions.scrollViewportHeight,
            minPosition: yRange.min,
            maxPosition: yRange.max
          });
          dimensions.scrollContainer.scrollTop = solvedY.scroll;
          position.top = solvedY.position;
        } else {
          position.top = clamp(position.top, yRange.min, yRange.max);
        }
      }
    }
    if (isHorizontalPlacement(finalPlacement)) {
      let status = getOffScreenStatus(anchorRect, "horizontal");
      if (status === "before") {
        position.left = minX;
      } else if (status === "after") {
        position.left = maxX - dimensions.width;
      }
    } else if (isVerticalPlacement(finalPlacement)) {
      let status = getOffScreenStatus(anchorRect, "vertical");
      if (status === "before") {
        position.top = minY;
      } else if (status === "after") {
        position.top = maxY - dimensions.height;
      }
    }
    floating.style.position = isFixed ? "fixed" : "absolute";
    floating.style.inset = "auto";
    floating.style.top = `${position.top}px`;
    floating.style.left = `${position.left}px`;
    lastAnchorRect = anchorRect;
    lastFloatingDimensions = dimensions;
  }
  updatePosition();
  function pollForPositionChanges() {
    let currentRect = readAnchorRect(anchorTarget);
    let currentDimensions = getFloatingDimensions(floating, relativeTo);
    if (hasRectChanged(currentRect, lastAnchorRect) || hasFloatingDimensionsChanged(currentDimensions, lastFloatingDimensions)) {
      updatePosition(currentRect, currentDimensions);
    }
    animationFrameId = requestAnimationFrame(pollForPositionChanges);
  }
  function handleScroll() {
    updatePosition();
  }
  function handleResize() {
    updatePosition();
  }
  animationFrameId = requestAnimationFrame(pollForPositionChanges);
  window.addEventListener("scroll", handleScroll, { passive: true });
  window.addEventListener("resize", handleResize, { passive: true });
  return () => {
    cancelAnimationFrame(animationFrameId);
    window.removeEventListener("scroll", handleScroll);
    window.removeEventListener("resize", handleResize);
  };
}

// node_modules/@remix-run/ui/dist/lib/outside-click.js
var onOutsideClick = createMixin((handle) => {
  let active = false;
  let handler = () => {
  };
  let isInsideTarget = () => false;
  let stopPropagation = true;
  handle.addEventListener("insert", (event) => {
    let node = event.node;
    let doc = node.ownerDocument;
    doc.addEventListener("click", (event2) => {
      let target = event2.target instanceof Node ? event2.target : null;
      if (!active || target && (node.contains(target) || isInsideTarget(target))) {
        return;
      }
      if (stopPropagation) {
        event2.stopPropagation();
      }
      handler(target);
    }, { capture: true, signal: handle.signal });
  });
  return (nextActive, nextHandler, nextIsInsideTarget = () => false, nextStopPropagation = true) => {
    active = nextActive;
    handler = nextHandler;
    isInsideTarget = nextIsInsideTarget;
    stopPropagation = nextStopPropagation;
  };
});

// node_modules/@remix-run/ui/dist/lib/scroll-lock.js
var scrollLocks = /* @__PURE__ */ new WeakMap();
function lockScroll(targetDocument = globalThis.document) {
  if (!targetDocument?.body || !targetDocument.defaultView) {
    return () => {
    };
  }
  let document2 = targetDocument;
  let documentElement = document2.documentElement;
  let view = document2.defaultView;
  let state = scrollLocks.get(document2);
  if (!state) {
    let scrollX = view.scrollX;
    let scrollY = view.scrollY;
    let scrollbarWidth = documentElement.clientWidth > 0 ? Math.max(view.innerWidth - documentElement.clientWidth, 0) : 0;
    let computedScrollbarGutter = view.getComputedStyle(documentElement).scrollbarGutter;
    state = {
      count: 0,
      documentOverflow: documentElement.style.overflow,
      documentScrollbarGutter: documentElement.style.scrollbarGutter,
      scrollX,
      scrollY
    };
    documentElement.style.overflow = "hidden";
    if (scrollbarWidth > 0 && computedScrollbarGutter === "auto") {
      documentElement.style.scrollbarGutter = "stable";
    }
    scrollLocks.set(document2, state);
  }
  state.count++;
  let unlocked = false;
  return () => {
    if (unlocked) {
      return;
    }
    unlocked = true;
    let currentState = scrollLocks.get(document2);
    if (!currentState) {
      return;
    }
    currentState.count--;
    if (currentState.count > 0) {
      return;
    }
    scrollLocks.delete(document2);
    documentElement.style.overflow = currentState.documentOverflow;
    documentElement.style.scrollbarGutter = currentState.documentScrollbarGutter;
    view.scrollTo(currentState.scrollX, currentState.scrollY);
  };
}

// node_modules/@remix-run/ui/dist/popover.js
function PopoverProvider(handle) {
  handle.context.set({
    hideFocusTarget: null,
    showFocusTarget: null,
    surface: null,
    anchor: null
  });
  return () => handle.props.children;
}
var anchorMixin = createMixin((handle) => {
  let context = handle.context.get(PopoverProvider);
  return (options) => {
    handle.queueTask((node) => {
      context.anchor = { target: node, options };
    });
  };
});
function anchorContains(anchor2, target) {
  return anchor2?.target instanceof HTMLElement && anchor2.target.contains(target);
}
var surfaceMixin = createMixin((handle) => {
  let openProp = false;
  let cleanupAnchor = () => {
  };
  let unlockScroll = () => {
  };
  let context = handle.context.get(PopoverProvider);
  handle.queueTask((node, signal) => {
    context.surface = node;
    signal.addEventListener("abort", () => {
      if (context.surface === node) {
        context.surface = null;
      }
    });
  });
  return (options) => {
    let wasOpen = openProp;
    openProp = options.open;
    handle.queueTask(async (node) => {
      if (openProp && !wasOpen) {
        node.showPopover();
      } else if (!openProp && wasOpen) {
        node.hidePopover();
      }
    });
    return [
      attrs({ popover: "manual" }),
      on("beforetoggle", (event) => {
        if (event.newState === "open") {
          let anchor2 = context.anchor;
          if (!anchor2) {
            throw new Error("popover.surface() requires a registered anchor before opening");
          }
          cleanupAnchor = anchor(event.currentTarget, anchor2.target, anchor2.options);
          unlockScroll = lockScroll();
        } else if (event.newState === "closed") {
          cleanupAnchor();
          unlockScroll();
        }
      }),
      on("toggle", async (event) => {
        if (event.newState === "open") {
          context.showFocusTarget?.focus();
        } else if (event.newState === "closed" && options.restoreFocusOnHide !== false) {
          context.hideFocusTarget?.focus();
        }
      }),
      on("keydown", (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          options.onHide({ reason: "escape-key" });
        }
      }),
      onOutsideClick(openProp, (target) => {
        options.onHide({ reason: "outside-click", target });
      }, (target) => options.closeOnAnchorClick === false && anchorContains(context.anchor, target), options.stopOutsideClickPropagation ?? true)
    ];
  };
});
var focusOnShowMixin = createMixin((handle) => {
  handle.addEventListener("insert", (event) => {
    let context = handle.context.get(PopoverProvider);
    context.showFocusTarget = event.node;
  });
});
var focusOnHideMixin = createMixin((handle) => {
  handle.addEventListener("insert", (event) => {
    let context = handle.context.get(PopoverProvider);
    context.hideFocusTarget = event.node;
  });
});
var Context = PopoverProvider;
var surface = surfaceMixin;

// app/features/challenge/ui/player-list.tsx
var panelStyle2 = css({
  position: "fixed",
  top: 0,
  right: 0,
  bottom: 0,
  width: "min(22rem, 90vw)",
  overflowY: "auto",
  background: "var(--color-bg-card)",
  borderLeft: "1px solid var(--color-border)",
  boxShadow: "var(--shadow-card)",
  padding: "1rem",
  zIndex: 60
});
var toolbarStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.5rem",
  marginBottom: "0.75rem",
  "& h2": {
    margin: 0,
    fontSize: "1rem",
    fontFamily: "var(--font-serif)",
    color: "var(--color-primary)"
  }
});
var listStyle2 = css({
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gap: "0.25rem"
});
var itemStyle = css({
  display: "grid",
  gridTemplateColumns: "auto auto 1fr",
  alignItems: "center",
  gap: "0.5rem",
  width: "100%",
  padding: "0.5rem 0.625rem",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-control)",
  background: "var(--color-bg-card)",
  textAlign: "left",
  font: "inherit",
  cursor: "pointer",
  "&:hover": { background: "var(--color-primary-soft)" }
});
var currentItemStyle = css({
  borderColor: "var(--color-primary)",
  background: "var(--color-primary-soft)"
});
var promptStyle = css({
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: "var(--color-text-muted)",
  fontSize: "0.85rem"
});
function PlayerList(handle) {
  return () => {
    const { state, questions, mode, open, onSelect, onClose } = handle.props;
    if (!open) {
      return null;
    }
    const currentQuestionId = state.questionIds[state.currentIndex];
    const listedQuestions = mode === "question" ? questions : state.questionIds.map((questionId) => questions.find((item) => item.id === questionId)).filter((question) => question !== void 0);
    return /* @__PURE__ */ jsx(Context, { children: /* @__PURE__ */ jsx(
      "aside",
      {
        "aria-label": "\u554F\u984C\u4E00\u89A7",
        mix: [
          panelStyle2,
          animateEntrance({ opacity: 0, x: 24, ...spring("snappy") }),
          animateExit({ opacity: 0, x: 24, ...spring("snappy") }),
          surface({ open, onHide: onClose })
        ],
        children: [
          /* @__PURE__ */ jsx("div", { mix: toolbarStyle, children: [
            /* @__PURE__ */ jsx("h2", { children: "\u554F\u984C\u4E00\u89A7" }),
            /* @__PURE__ */ jsx("button", { type: "button", mix: on("click", onClose), "aria-label": "\u554F\u984C\u4E00\u89A7\u3092\u9589\u3058\u308B", children: /* @__PURE__ */ jsx(CloseIcon, {}) })
          ] }),
          /* @__PURE__ */ jsx("ol", { mix: listStyle2, children: listedQuestions.map((question, index) => {
            const judgment = state.judgments[question.id];
            const isCurrent = question.id === currentQuestionId;
            return /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                mix: [
                  itemStyle,
                  isCurrent ? currentItemStyle : null,
                  on("click", () => onSelect(index))
                ],
                "aria-current": isCurrent ? "true" : void 0,
                children: [
                  /* @__PURE__ */ jsx("span", { children: [
                    "\u554F",
                    question.number ?? index + 1
                  ] }),
                  mode === "exam" ? /* @__PURE__ */ jsx("span", { children: formatDuration(state.questionElapsedMs[question.id] ?? 0) }) : null,
                  judgment ? /* @__PURE__ */ jsx("span", { children: judgment === "correct" ? "\u25CB" : "\xD7" }) : /* @__PURE__ */ jsx("span", {}),
                  /* @__PURE__ */ jsx("span", { mix: promptStyle, children: question.text })
                ]
              }
            ) }, question.id);
          }) })
        ]
      }
    ) });
  };
}

// app/lib/figures/binary-tree.ts
function getTreeDepth(node) {
  if (!node) {
    return 0;
  }
  return 1 + Math.max(getTreeDepth(node.left), getTreeDepth(node.right));
}
function calculatePositions(root, width, height, nodeRadius) {
  const depth = getTreeDepth(root);
  const walk = (node, level, left, right) => {
    if (!node) {
      return [];
    }
    const x = node.x === void 0 ? (left + right) / 2 : node.x;
    const y = node.y === void 0 ? (level + 1) / (depth + 1) * height : node.y;
    const current = { x, y, node };
    const leftPositions = node.left ? walk(node.left, level + 1, left, x) : [];
    const rightPositions = node.right ? walk(node.right, level + 1, x, right) : [];
    return [current, ...leftPositions, ...rightPositions];
  };
  return walk(root, 0, nodeRadius * 2, width - nodeRadius * 2);
}
function getEdgeLines(positions, nodeRadius) {
  const positionMap = new Map(positions.map((pos) => [pos.node, pos]));
  const collectEdges = (node, parentPos) => {
    if (!(node && parentPos)) {
      return [];
    }
    const currentPos = positionMap.get(node);
    if (!currentPos) {
      return [];
    }
    const childEdges = [
      ...node.left ? collectEdges(node.left, currentPos) : [],
      ...node.right ? collectEdges(node.right, currentPos) : []
    ];
    return [{ from: parentPos, to: currentPos }, ...childEdges];
  };
  const root = positions[0]?.node;
  const rootPos = root ? positionMap.get(root) : void 0;
  const edges = root && rootPos ? [
    ...root.left ? collectEdges(root.left, rootPos) : [],
    ...root.right ? collectEdges(root.right, rootPos) : []
  ] : [];
  return edges.map((edge) => {
    const dx = edge.to.x - edge.from.x;
    const dy = edge.to.y - edge.from.y;
    const angle = Math.atan2(dy, dx);
    return {
      x1: edge.from.x + nodeRadius * Math.cos(angle),
      y1: edge.from.y + nodeRadius * Math.sin(angle),
      x2: edge.to.x - nodeRadius * Math.cos(angle),
      y2: edge.to.y - nodeRadius * Math.sin(angle)
    };
  });
}

// app/ui/figures/BinaryTree.tsx
var svgStyle = css({
  maxWidth: "100%",
  height: "auto",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-control)"
});
function BinaryTree(handle) {
  return () => {
    const { root, width = 300, height = 200, nodeRadius = 20 } = handle.props;
    const positions = calculatePositions(root, width, height, nodeRadius);
    const edgeLines = getEdgeLines(positions, nodeRadius);
    return /* @__PURE__ */ jsx(
      "svg",
      {
        width: "100%",
        height: "auto",
        viewBox: `0 0 ${width} ${height}`,
        preserveAspectRatio: "xMidYMid meet",
        mix: svgStyle,
        style: `aspect-ratio: ${width}/${height}`,
        "aria-label": "\u4E8C\u5206\u6728",
        children: [
          /* @__PURE__ */ jsx("title", { children: "\u4E8C\u5206\u6728" }),
          edgeLines.map((line) => /* @__PURE__ */ jsx(
            "line",
            {
              x1: line.x1,
              y1: line.y1,
              x2: line.x2,
              y2: line.y2,
              stroke: "black",
              "stroke-width": "1.5"
            }
          )),
          positions.map((pos) => /* @__PURE__ */ jsx("g", { children: [
            /* @__PURE__ */ jsx(
              "circle",
              {
                cx: pos.x,
                cy: pos.y,
                r: nodeRadius,
                fill: "white",
                stroke: "black",
                "stroke-width": "1.5"
              }
            ),
            /* @__PURE__ */ jsx(
              "text",
              {
                x: pos.x,
                y: pos.y,
                "font-size": "14",
                "text-anchor": "middle",
                "dominant-baseline": "middle",
                fill: "black",
                children: pos.node.value
              }
            )
          ] }))
        ]
      }
    );
  };
}

// app/lib/figures/svg-path.ts
function pointsToPolyline(points) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

// app/lib/figures/flowchart.ts
var FLOWCHART_DEFAULTS = {
  WIDTH: 300,
  HEIGHT: 400,
  NODE_WIDTH: 100,
  NODE_WIDTH_DECISION: 80,
  NODE_HEIGHT: 30,
  NODE_HEIGHT_DECISION: 40
};
function getNodeDimensions(node) {
  const defaultWidth = node.type === "decision" ? FLOWCHART_DEFAULTS.NODE_WIDTH_DECISION : FLOWCHART_DEFAULTS.NODE_WIDTH;
  const defaultHeight = node.type === "decision" ? FLOWCHART_DEFAULTS.NODE_HEIGHT_DECISION : FLOWCHART_DEFAULTS.NODE_HEIGHT;
  return {
    w: node.width ?? defaultWidth,
    h: node.height ?? defaultHeight
  };
}
function getEdgePoint(node, side) {
  const { w, h } = getNodeDimensions(node);
  switch (side) {
    case "top":
      return { x: node.x, y: node.y - h / 2 };
    case "bottom":
      return { x: node.x, y: node.y + h / 2 };
    case "left":
      return { x: node.x - w / 2, y: node.y };
    case "right":
      return { x: node.x + w / 2, y: node.y };
    default:
      throw new Error(`unreachable: unknown edge side ${side}`);
  }
}
function buildNodeRenderData(nodes) {
  return nodes.map((node) => {
    const { w, h } = getNodeDimensions(node);
    const base = {
      type: node.type,
      id: node.id,
      x: node.x,
      y: node.y,
      w,
      h,
      label: node.label
    };
    if (node.type === "decision") {
      return {
        ...base,
        points: `${node.x},${node.y - h / 2} ${node.x + w / 2},${node.y} ${node.x},${node.y + h / 2} ${node.x - w / 2},${node.y}`
      };
    }
    if (node.type === "start" || node.type === "end") {
      return { ...base, rx: h / 2, ry: h / 2 };
    }
    return base;
  });
}
function buildEdgeRenderData(nodes, edges) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  return edges.flatMap((edge) => {
    const fromNode = nodeMap.get(edge.from);
    const toNode = nodeMap.get(edge.to);
    if (!(fromNode && toNode)) {
      return [];
    }
    const fromSide = edge.fromSide ?? "bottom";
    const toSide = edge.toSide ?? "top";
    const start = getEdgePoint(fromNode, fromSide);
    const end = getEdgePoint(toNode, toSide);
    const manualPoints = edge.points ?? [];
    const hasManualPoints = manualPoints.length > 0;
    const points = hasManualPoints ? [start, ...manualPoints, end] : [start, end];
    const pathD = pointsToPolyline(points);
    const labelPoint = hasManualPoints ? manualPoints[0] : { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    return [{ pathD, label: edge.label, labelX: labelPoint.x, labelY: labelPoint.y }];
  });
}

// app/ui/figures/Flowchart.tsx
var svgStyle2 = css({ maxWidth: "100%", height: "auto" });
function Flowchart(handle) {
  return () => {
    const {
      nodes,
      edges,
      width = FLOWCHART_DEFAULTS.WIDTH,
      height = FLOWCHART_DEFAULTS.HEIGHT
    } = handle.props;
    const nodeRenderData = buildNodeRenderData(nodes);
    const edgeRenderData = buildEdgeRenderData(nodes, edges);
    return /* @__PURE__ */ jsx(
      "svg",
      {
        width: "100%",
        height: "auto",
        viewBox: `0 0 ${width} ${height}`,
        preserveAspectRatio: "xMidYMid meet",
        mix: svgStyle2,
        style: `aspect-ratio: ${width}/${height}`,
        "aria-label": "\u30D5\u30ED\u30FC\u30C1\u30E3\u30FC\u30C8",
        children: [
          /* @__PURE__ */ jsx("title", { children: "\u30D5\u30ED\u30FC\u30C1\u30E3\u30FC\u30C8" }),
          /* @__PURE__ */ jsx("defs", { children: /* @__PURE__ */ jsx(
            "marker",
            {
              id: "flowchart-arrow",
              markerWidth: "10",
              markerHeight: "10",
              refX: "9",
              refY: "3",
              orient: "auto",
              markerUnits: "strokeWidth",
              children: /* @__PURE__ */ jsx("polygon", { points: "0 0, 10 3, 0 6", fill: "black" })
            }
          ) }),
          edgeRenderData.map((e) => /* @__PURE__ */ jsx("g", { children: [
            /* @__PURE__ */ jsx(
              "path",
              {
                d: e.pathD,
                fill: "none",
                stroke: "black",
                "stroke-width": "1.5",
                "marker-end": "url(#flowchart-arrow)"
              }
            ),
            e.label && /* @__PURE__ */ jsx(
              "text",
              {
                x: e.labelX + 8,
                y: e.labelY - 4,
                "font-size": "10",
                fill: "black",
                "font-weight": "bold",
                children: e.label
              }
            )
          ] })),
          nodeRenderData.map((n) => {
            if (n.type === "start" || n.type === "end") {
              return /* @__PURE__ */ jsx("g", { children: [
                /* @__PURE__ */ jsx(
                  "rect",
                  {
                    x: n.x - n.w / 2,
                    y: n.y - n.h / 2,
                    width: n.w,
                    height: n.h,
                    rx: n.rx,
                    ry: n.ry,
                    fill: "white",
                    stroke: "black",
                    "stroke-width": "1.5"
                  }
                ),
                /* @__PURE__ */ jsx(
                  "text",
                  {
                    x: n.x,
                    y: n.y,
                    "text-anchor": "middle",
                    "dominant-baseline": "middle",
                    "font-size": "12",
                    fill: "black",
                    children: n.label
                  }
                )
              ] });
            }
            if (n.type === "process") {
              return /* @__PURE__ */ jsx("g", { children: [
                /* @__PURE__ */ jsx(
                  "rect",
                  {
                    x: n.x - n.w / 2,
                    y: n.y - n.h / 2,
                    width: n.w,
                    height: n.h,
                    fill: "white",
                    stroke: "black",
                    "stroke-width": "1.5"
                  }
                ),
                /* @__PURE__ */ jsx(
                  "text",
                  {
                    x: n.x,
                    y: n.y,
                    "text-anchor": "middle",
                    "dominant-baseline": "middle",
                    "font-size": "11",
                    fill: "black",
                    children: n.label
                  }
                )
              ] });
            }
            if (n.type === "decision") {
              return /* @__PURE__ */ jsx("g", { children: [
                /* @__PURE__ */ jsx("polygon", { points: n.points, fill: "white", stroke: "black", "stroke-width": "1.5" }),
                /* @__PURE__ */ jsx(
                  "text",
                  {
                    x: n.x,
                    y: n.y,
                    "text-anchor": "middle",
                    "dominant-baseline": "middle",
                    "font-size": "11",
                    fill: "black",
                    children: n.label
                  }
                )
              ] });
            }
            if (n.type === "connector") {
              return /* @__PURE__ */ jsx("g", { children: /* @__PURE__ */ jsx("circle", { cx: n.x, cy: n.y, r: 8, fill: "white", stroke: "black", "stroke-width": "1.5" }) });
            }
            return null;
          })
        ]
      }
    );
  };
}

// app/lib/figures/logic-circuit.ts
var LOGIC_DEFAULTS = {
  GATE_WIDTH: 50,
  GATE_HEIGHT: 40
};
function getLogicCircuitViewport(inputs, outputs, gates, wires) {
  const points = [
    ...inputs.flatMap((input) => [
      { x: input.x - 34, y: input.y - 18 },
      { x: input.x + 4, y: input.y + 18 }
    ]),
    ...outputs.flatMap((output) => [
      { x: output.x - 4, y: output.y - 18 },
      { x: output.x + 34, y: output.y + 18 }
    ]),
    ...gates.flatMap((gate) => [
      {
        x: gate.x - LOGIC_DEFAULTS.GATE_WIDTH / 2 - 8,
        y: gate.y - LOGIC_DEFAULTS.GATE_HEIGHT / 2 - 8
      },
      {
        x: gate.x + LOGIC_DEFAULTS.GATE_WIDTH / 2 + 12,
        y: gate.y + LOGIC_DEFAULTS.GATE_HEIGHT / 2 + 30
      }
    ]),
    ...wires.flatMap((wire) => wire.points ?? [])
  ];
  if (points.length === 0) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY)
  };
}
function getGateSymbolPath(gate, gateWidth = LOGIC_DEFAULTS.GATE_WIDTH, gateHeight = LOGIC_DEFAULTS.GATE_HEIGHT) {
  const { x, y, type } = gate;
  switch (type) {
    case "AND":
      return `<g>
        <path d="M ${x - gateWidth / 2} ${y - gateHeight / 2} L ${x} ${y - gateHeight / 2} A ${gateWidth / 2} ${gateHeight / 2} 0 0 1 ${x} ${y + gateHeight / 2} L ${x - gateWidth / 2} ${y + gateHeight / 2} Z" fill="white" stroke="black" stroke-width="1.5" />
      </g>`;
    case "OR":
      return `<g>
        <path d="M ${x - gateWidth / 2} ${y - gateHeight / 2} Q ${x - gateWidth / 4} ${y - gateHeight / 2} ${x} ${y - gateHeight / 2} A ${gateWidth / 1.5} ${gateHeight / 2} 0 0 1 ${x} ${y + gateHeight / 2} Q ${x - gateWidth / 4} ${y + gateHeight / 2} ${x - gateWidth / 2} ${y + gateHeight / 2} Q ${x - gateWidth / 3} ${y} ${x - gateWidth / 2} ${y - gateHeight / 2} Z" fill="white" stroke="black" stroke-width="1.5" />
      </g>`;
    case "NOT":
      return `<g>
        <path d="M ${x - gateWidth / 2} ${y - gateHeight / 2} L ${x + gateWidth / 3} ${y} L ${x - gateWidth / 2} ${y + gateHeight / 2} Z" fill="white" stroke="black" stroke-width="1.5" />
        <circle cx="${x + gateWidth / 3 + 5}" cy="${y}" r="5" fill="white" stroke="black" stroke-width="1.5" />
      </g>`;
    case "NAND":
      return `<g>
        <path d="M ${x - gateWidth / 2} ${y - gateHeight / 2} L ${x} ${y - gateHeight / 2} A ${gateWidth / 2} ${gateHeight / 2} 0 0 1 ${x} ${y + gateHeight / 2} L ${x - gateWidth / 2} ${y + gateHeight / 2} Z" fill="white" stroke="black" stroke-width="1.5" />
        <circle cx="${x + 5}" cy="${y}" r="5" fill="white" stroke="black" stroke-width="1.5" />
      </g>`;
    case "NOR":
      return `<g>
        <path d="M ${x - gateWidth / 2} ${y - gateHeight / 2} Q ${x - gateWidth / 4} ${y - gateHeight / 2} ${x} ${y - gateHeight / 2} A ${gateWidth / 1.5} ${gateHeight / 2} 0 0 1 ${x} ${y + gateHeight / 2} Q ${x - gateWidth / 4} ${y + gateHeight / 2} ${x - gateWidth / 2} ${y + gateHeight / 2} Q ${x - gateWidth / 3} ${y} ${x - gateWidth / 2} ${y - gateHeight / 2} Z" fill="white" stroke="black" stroke-width="1.5" />
        <circle cx="${x + 5}" cy="${y}" r="5" fill="white" stroke="black" stroke-width="1.5" />
      </g>`;
    case "XOR":
      return `<g>
        <path d="M ${x - gateWidth / 2 + 5} ${y - gateHeight / 2} Q ${x - gateWidth / 4 + 5} ${y - gateHeight / 2} ${x + 5} ${y - gateHeight / 2} A ${gateWidth / 1.5} ${gateHeight / 2} 0 0 1 ${x + 5} ${y + gateHeight / 2} Q ${x - gateWidth / 4 + 5} ${y + gateHeight / 2} ${x - gateWidth / 2 + 5} ${y + gateHeight / 2} Q ${x - gateWidth / 3 + 5} ${y} ${x - gateWidth / 2 + 5} ${y - gateHeight / 2} Z" fill="white" stroke="black" stroke-width="1.5" />
        <path d="M ${x - gateWidth / 2} ${y - gateHeight / 2} Q ${x - gateWidth / 3} ${y} ${x - gateWidth / 2} ${y + gateHeight / 2}" fill="none" stroke="black" stroke-width="1.5" />
      </g>`;
    case "XNOR":
      return `<g>
        <path d="M ${x - gateWidth / 2 + 5} ${y - gateHeight / 2} Q ${x - gateWidth / 4 + 5} ${y - gateHeight / 2} ${x + 5} ${y - gateHeight / 2} A ${gateWidth / 1.5} ${gateHeight / 2} 0 0 1 ${x + 5} ${y + gateHeight / 2} Q ${x - gateWidth / 4 + 5} ${y + gateHeight / 2} ${x - gateWidth / 2 + 5} ${y + gateHeight / 2} Q ${x - gateWidth / 3 + 5} ${y} ${x - gateWidth / 2 + 5} ${y - gateHeight / 2} Z" fill="white" stroke="black" stroke-width="1.5" />
        <path d="M ${x - gateWidth / 2} ${y - gateHeight / 2} Q ${x - gateWidth / 3} ${y} ${x - gateWidth / 2} ${y + gateHeight / 2}" fill="none" stroke="black" stroke-width="1.5" />
        <circle cx="${x + 10}" cy="${y}" r="5" fill="white" stroke="black" stroke-width="1.5" />
      </g>`;
    default:
      return "";
  }
}
function getWirePath(wire, inputs, outputs, gates, gateWidth = LOGIC_DEFAULTS.GATE_WIDTH) {
  const elementMap = new Map([...inputs, ...gates, ...outputs].map((el) => [el.id, el]));
  const fromElement = elementMap.get(wire.from);
  const toElement = elementMap.get(wire.to);
  if (!(fromElement && toElement)) {
    return null;
  }
  const inputIds = new Set(inputs.map((input) => input.id));
  const outputIds = new Set(outputs.map((output) => output.id));
  const gateIds = new Set(gates.map((gate) => gate.id));
  const wirePoints = wire.points ?? [];
  const lastPoint = wirePoints.at(-1);
  const start = inputIds.has(fromElement.id) ? { x: fromElement.x + 20, y: fromElement.y } : { x: fromElement.x + gateWidth / 2, y: fromElement.y };
  const end = outputIds.has(toElement.id) ? { x: toElement.x - 20, y: toElement.y } : {
    x: toElement.x - gateWidth / 2,
    y: gateIds.has(toElement.id) && lastPoint ? lastPoint.y : toElement.y
  };
  const points = wirePoints.length > 0 ? [start, ...wirePoints, end] : [start, end];
  return pointsToPolyline(points);
}

// app/ui/figures/LogicCircuit.tsx
var svgResponsiveStyle = css({ display: "block", maxWidth: "100%" });
var circuitFrameStyle = css({
  overflow: "hidden",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-control)"
});
function LogicCircuit(handle) {
  return () => {
    const { circuit, mode = "responsive" } = handle.props;
    const { inputs, outputs, gates, wires, width = 500, height = 300 } = circuit;
    const responsive = mode === "responsive";
    const viewport = responsive ? getLogicCircuitViewport(inputs, outputs, gates, wires) : { x: 0, y: 0, width, height };
    const showSvgLabels = mode === "fixed";
    const svg = /* @__PURE__ */ jsx(
      "svg",
      {
        width: responsive ? "100%" : width,
        height: responsive ? "100%" : height,
        viewBox: `${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`,
        preserveAspectRatio: "xMidYMid meet",
        mix: responsive ? svgResponsiveStyle : void 0,
        style: "background-color: #fff",
        "aria-label": "\u8AD6\u7406\u56DE\u8DEF\u56F3",
        children: [
          /* @__PURE__ */ jsx("title", { children: "\u8AD6\u7406\u56DE\u8DEF\u56F3" }),
          wires.map((wire) => {
            const pathData = getWirePath(wire, inputs, outputs, gates);
            return pathData ? /* @__PURE__ */ jsx("g", { children: /* @__PURE__ */ jsx("path", { d: pathData, stroke: "black", "stroke-width": "1.5", fill: "none" }) }) : null;
          }),
          inputs.map((input) => /* @__PURE__ */ jsx("g", { children: [
            /* @__PURE__ */ jsx("circle", { cx: input.x, cy: input.y, r: "4", fill: "black" }),
            showSvgLabels ? /* @__PURE__ */ jsx(
              "text",
              {
                x: input.x - 10,
                y: input.y,
                "font-size": "14",
                "text-anchor": "end",
                "dominant-baseline": "middle",
                fill: "black",
                children: input.label
              }
            ) : null
          ] })),
          gates.map((gate) => /* @__PURE__ */ jsx("g", { children: [
            /* @__PURE__ */ jsx("g", { innerHTML: unsafeHTML(getGateSymbolPath(gate)) }),
            showSvgLabels ? /* @__PURE__ */ jsx(
              "text",
              {
                x: gate.x,
                y: gate.y + LOGIC_DEFAULTS.GATE_HEIGHT / 2 + 15,
                "font-size": "12",
                "text-anchor": "middle",
                fill: "black",
                "font-weight": "bold",
                children: gate.type
              }
            ) : null
          ] })),
          outputs.map((output) => /* @__PURE__ */ jsx("g", { children: [
            /* @__PURE__ */ jsx("circle", { cx: output.x, cy: output.y, r: "4", fill: "black" }),
            showSvgLabels ? /* @__PURE__ */ jsx(
              "text",
              {
                x: output.x + 10,
                y: output.y,
                "font-size": "14",
                "text-anchor": "start",
                "dominant-baseline": "middle",
                fill: "black",
                children: output.label
              }
            ) : null
          ] }))
        ]
      }
    );
    if (mode === "fixed") {
      return svg;
    }
    const labelStyle2 = (x, y, fontSize) => {
      const left = responsive ? `${(x - viewport.x) / viewport.width * 100}%` : `${x}px`;
      const top = responsive ? `${(y - viewport.y) / viewport.height * 100}%` : `${y}px`;
      return `position:absolute;left:${left};top:${top};font-size:${fontSize}px;line-height:1;color:#000;transform:translate(-50%,-50%);white-space:nowrap`;
    };
    const wrapperStyle = responsive ? `position:relative;width:100%;max-width:${viewport.width}px;aspect-ratio:${viewport.width}/${viewport.height};background:#fff` : `position:relative;width:${width}px;height:${height}px;background:#fff`;
    return /* @__PURE__ */ jsx("div", { mix: responsive ? circuitFrameStyle : void 0, style: wrapperStyle, children: [
      svg,
      inputs.map((input) => /* @__PURE__ */ jsx("span", { "aria-hidden": "true", style: labelStyle2(input.x - 17, input.y, 14), children: input.label })),
      gates.map((gate) => /* @__PURE__ */ jsx(
        "span",
        {
          "aria-hidden": "true",
          style: `${labelStyle2(gate.x, gate.y + LOGIC_DEFAULTS.GATE_HEIGHT / 2 + 15, 12)};font-weight:700`,
          children: gate.type
        }
      )),
      outputs.map((output) => /* @__PURE__ */ jsx("span", { "aria-hidden": "true", style: labelStyle2(output.x + 17, output.y, 14), children: output.label }))
    ] });
  };
}

// app/lib/figures/parity-check.ts
function calculateParity(data, cellSize) {
  const rows = data.length;
  const cols = data[0]?.length || 0;
  const horizontalParity = data.map((row) => row.reduce((acc, bit) => acc ^ bit, 0));
  const verticalParity = Array.from(
    { length: cols },
    (_, colIndex) => data.reduce((acc, row) => acc ^ row[colIndex], 0)
  );
  const dataCells = data.flatMap(
    (row, rowIndex) => row.map((bit, colIndex) => ({
      bit,
      rowIndex,
      colIndex
    }))
  );
  const totalParity = horizontalParity.reduce((acc, bit) => acc ^ bit, 0);
  return {
    rows,
    cols,
    dataCells,
    horizontalParity,
    verticalParity,
    totalParity,
    svgWidth: (cols + 2) * cellSize,
    svgHeight: (rows + 2) * cellSize
  };
}

// app/ui/figures/ParityCheck.tsx
var svgStyle3 = css({
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-control)"
});
function ParityCheck(handle) {
  return () => {
    const { data, width = 300, height = 300, cellSize = 40 } = handle.props;
    const parity = calculateParity(data, cellSize);
    return /* @__PURE__ */ jsx(
      "svg",
      {
        width,
        height,
        viewBox: `0 0 ${parity.svgWidth} ${parity.svgHeight}`,
        mix: svgStyle3,
        "aria-label": "\u30D1\u30EA\u30C6\u30A3\u691C\u67FB\u56F3",
        children: [
          /* @__PURE__ */ jsx("title", { children: "\u30D1\u30EA\u30C6\u30A3\u691C\u67FB\u56F3" }),
          parity.dataCells.map((cell) => /* @__PURE__ */ jsx("g", { children: [
            /* @__PURE__ */ jsx(
              "rect",
              {
                x: (cell.colIndex + 1) * cellSize,
                y: (cell.rowIndex + 1) * cellSize,
                width: cellSize,
                height: cellSize,
                fill: "white",
                stroke: "black",
                "stroke-width": "1"
              }
            ),
            /* @__PURE__ */ jsx(
              "text",
              {
                x: (cell.colIndex + 1.5) * cellSize,
                y: (cell.rowIndex + 1.5) * cellSize,
                "font-size": "16",
                "text-anchor": "middle",
                "dominant-baseline": "middle",
                fill: "black",
                children: cell.bit
              }
            )
          ] })),
          parity.horizontalParity.map((bit, rowIndex) => /* @__PURE__ */ jsx("g", { children: [
            /* @__PURE__ */ jsx(
              "rect",
              {
                x: (parity.cols + 1) * cellSize,
                y: (rowIndex + 1) * cellSize,
                width: cellSize,
                height: cellSize,
                fill: "#e0f2fe",
                stroke: "black",
                "stroke-width": "1"
              }
            ),
            /* @__PURE__ */ jsx(
              "text",
              {
                x: (parity.cols + 1.5) * cellSize,
                y: (rowIndex + 1.5) * cellSize,
                "font-size": "16",
                "text-anchor": "middle",
                "dominant-baseline": "middle",
                fill: "black",
                children: bit
              }
            )
          ] })),
          parity.verticalParity.map((bit, colIndex) => /* @__PURE__ */ jsx("g", { children: [
            /* @__PURE__ */ jsx(
              "rect",
              {
                x: (colIndex + 1) * cellSize,
                y: (parity.rows + 1) * cellSize,
                width: cellSize,
                height: cellSize,
                fill: "#e0f2fe",
                stroke: "black",
                "stroke-width": "1"
              }
            ),
            /* @__PURE__ */ jsx(
              "text",
              {
                x: (colIndex + 1.5) * cellSize,
                y: (parity.rows + 1.5) * cellSize,
                "font-size": "16",
                "text-anchor": "middle",
                "dominant-baseline": "middle",
                fill: "black",
                children: bit
              }
            )
          ] })),
          /* @__PURE__ */ jsx("g", { children: [
            /* @__PURE__ */ jsx(
              "rect",
              {
                x: (parity.cols + 1) * cellSize,
                y: (parity.rows + 1) * cellSize,
                width: cellSize,
                height: cellSize,
                fill: "#dbeafe",
                stroke: "black",
                "stroke-width": "1"
              }
            ),
            /* @__PURE__ */ jsx(
              "text",
              {
                x: (parity.cols + 1.5) * cellSize,
                y: (parity.rows + 1.5) * cellSize,
                "font-size": "16",
                "text-anchor": "middle",
                "dominant-baseline": "middle",
                fill: "black",
                children: parity.totalParity
              }
            )
          ] }),
          /* @__PURE__ */ jsx(
            "text",
            {
              x: 0.5 * cellSize,
              y: 0.5 * cellSize,
              "font-size": "12",
              "text-anchor": "middle",
              "dominant-baseline": "middle",
              fill: "black",
              children: "Data"
            }
          ),
          /* @__PURE__ */ jsx(
            "text",
            {
              x: (parity.cols + 1.5) * cellSize,
              y: 0.5 * cellSize,
              "font-size": "12",
              "text-anchor": "middle",
              "dominant-baseline": "middle",
              fill: "black",
              children: "H"
            }
          ),
          /* @__PURE__ */ jsx(
            "text",
            {
              x: 0.5 * cellSize,
              y: (parity.rows + 1.5) * cellSize,
              "font-size": "12",
              "text-anchor": "middle",
              "dominant-baseline": "middle",
              fill: "black",
              children: "V"
            }
          )
        ]
      }
    );
  };
}

// app/lib/figures/state-diagram.ts
var STATE_DEFAULTS = {
  NODE_RADIUS: 20,
  ACCEPTING_NODE_RADIUS: 25,
  ARROW_SIZE: 6,
  SELF_LOOP_RADIUS: 15
};
function getArrowPath(from, to, curveOffset = 0) {
  const { x: fromX, y: fromY } = from;
  const { x: toX, y: toY } = to;
  if (curveOffset === 0) {
    return `M ${fromX} ${fromY} L ${toX} ${toY}`;
  }
  const midX = (fromX + toX) / 2;
  const midY = (fromY + toY) / 2;
  const dx = toX - fromX;
  const dy = toY - fromY;
  const perpX = -dy;
  const perpY = dx;
  const length = Math.sqrt(perpX * perpX + perpY * perpY);
  const controlX = midX + perpX / length * curveOffset;
  const controlY = midY + perpY / length * curveOffset;
  return `M ${fromX} ${fromY} Q ${controlX} ${controlY} ${toX} ${toY}`;
}
function getArrowHead(from, to, curveOffset = 0, nodeRadius = STATE_DEFAULTS.NODE_RADIUS) {
  const { x: fromX, y: fromY } = from;
  const { x: toX, y: toY } = to;
  const arrowSize = STATE_DEFAULTS.ARROW_SIZE;
  const angle = curveOffset === 0 ? Math.atan2(toY - fromY, toX - fromX) : (() => {
    const midX = (fromX + toX) / 2;
    const midY = (fromY + toY) / 2;
    const dx = toX - fromX;
    const dy = toY - fromY;
    const perpX = -dy;
    const perpY = dx;
    const length = Math.sqrt(perpX * perpX + perpY * perpY);
    const controlX = midX + perpX / length * curveOffset;
    const controlY = midY + perpY / length * curveOffset;
    return Math.atan2(toY - controlY, toX - controlX);
  })();
  const endX = toX - nodeRadius * Math.cos(angle);
  const endY = toY - nodeRadius * Math.sin(angle);
  const x1 = endX - arrowSize * Math.cos(angle - Math.PI / 6);
  const y1 = endY - arrowSize * Math.sin(angle - Math.PI / 6);
  const x2 = endX - arrowSize * Math.cos(angle + Math.PI / 6);
  const y2 = endY - arrowSize * Math.sin(angle + Math.PI / 6);
  return `M ${endX} ${endY} L ${x1} ${y1} M ${endX} ${endY} L ${x2} ${y2}`;
}
function getLabelPosition(from, to, curveOffset = 0) {
  const { x: fromX, y: fromY } = from;
  const { x: toX, y: toY } = to;
  if (curveOffset === 0) {
    return {
      x: (fromX + toX) / 2,
      y: (fromY + toY) / 2 - 5
    };
  }
  const midX = (fromX + toX) / 2;
  const midY = (fromY + toY) / 2;
  const dx = toX - fromX;
  const dy = toY - fromY;
  const perpX = -dy;
  const perpY = dx;
  const length = Math.sqrt(perpX * perpX + perpY * perpY);
  return {
    x: midX + perpX / length * curveOffset,
    y: midY + perpY / length * curveOffset - 5
  };
}
function buildTransitionData(nodes, transitions, nodeRadius = STATE_DEFAULTS.NODE_RADIUS, acceptingNodeRadius = STATE_DEFAULTS.ACCEPTING_NODE_RADIUS) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  return transitions.flatMap((transition2) => {
    const fromNode = nodeMap.get(transition2.from);
    const toNode = nodeMap.get(transition2.to);
    if (!(fromNode && toNode)) {
      return [];
    }
    if (transition2.from === transition2.to) {
      const radius = fromNode.isAccepting ? acceptingNodeRadius : nodeRadius;
      const cx = fromNode.x;
      const cy = fromNode.y - radius - STATE_DEFAULTS.SELF_LOOP_RADIUS;
      const r = STATE_DEFAULTS.SELF_LOOP_RADIUS;
      const renderData = {
        type: "selfLoop",
        label: transition2.label,
        cx,
        cy,
        r,
        arrowD: `M ${cx + r * 0.7} ${cy - r * 0.7} l 3 -3 M ${cx + r * 0.7} ${cy - r * 0.7} l 3 3`,
        labelX: cx,
        labelY: cy - r - 5
      };
      return [renderData];
    }
    const curveOffset = transition2.curveOffset || 0;
    const labelPos = getLabelPosition(
      { x: fromNode.x, y: fromNode.y },
      { x: toNode.x, y: toNode.y },
      curveOffset
    );
    const angle = Math.atan2(toNode.y - fromNode.y, toNode.x - fromNode.x);
    const start = curveOffset === 0 ? {
      x: fromNode.x + nodeRadius * Math.cos(angle),
      y: fromNode.y + nodeRadius * Math.sin(angle)
    } : { x: fromNode.x, y: fromNode.y };
    const end = curveOffset === 0 ? {
      x: toNode.x - nodeRadius * Math.cos(angle),
      y: toNode.y - nodeRadius * Math.sin(angle)
    } : { x: toNode.x, y: toNode.y };
    return [
      {
        type: "normal",
        label: transition2.label,
        pathD: getArrowPath(start, end, curveOffset),
        arrowHeadD: getArrowHead(start, end, curveOffset, nodeRadius),
        labelX: labelPos.x,
        labelY: labelPos.y
      }
    ];
  });
}

// app/ui/figures/StateDiagram.tsx
var svgStyle4 = css({
  maxWidth: "100%",
  height: "auto",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-control)"
});
function StateDiagram(handle) {
  return () => {
    const { nodes, transitions, width = 400, height = 150 } = handle.props;
    const nodeRadius = STATE_DEFAULTS.NODE_RADIUS;
    const acceptingNodeRadius = STATE_DEFAULTS.ACCEPTING_NODE_RADIUS;
    const transitionData = buildTransitionData(nodes, transitions, nodeRadius, acceptingNodeRadius);
    return /* @__PURE__ */ jsx(
      "svg",
      {
        width: "100%",
        height: "auto",
        viewBox: `0 0 ${width} ${height}`,
        preserveAspectRatio: "xMidYMid meet",
        mix: svgStyle4,
        style: `aspect-ratio: ${width}/${height}`,
        "aria-label": "\u72B6\u614B\u9077\u79FB\u56F3",
        children: [
          /* @__PURE__ */ jsx("title", { children: "\u72B6\u614B\u9077\u79FB\u56F3" }),
          transitionData.map(
            (t) => t.type === "selfLoop" ? /* @__PURE__ */ jsx("g", { children: [
              /* @__PURE__ */ jsx("circle", { cx: t.cx, cy: t.cy, r: t.r, fill: "none", stroke: "black", "stroke-width": "1.5" }),
              /* @__PURE__ */ jsx("path", { d: t.arrowD, stroke: "black", "stroke-width": "1.5", fill: "none" }),
              /* @__PURE__ */ jsx("text", { x: t.labelX, y: t.labelY, "font-size": "12", "text-anchor": "middle", fill: "black", children: t.label })
            ] }) : /* @__PURE__ */ jsx("g", { children: [
              /* @__PURE__ */ jsx("path", { d: t.pathD, stroke: "black", "stroke-width": "1.5", fill: "none" }),
              /* @__PURE__ */ jsx("path", { d: t.arrowHeadD, stroke: "black", "stroke-width": "1.5", fill: "none" }),
              /* @__PURE__ */ jsx("text", { x: t.labelX, y: t.labelY, "font-size": "12", "text-anchor": "middle", fill: "black", children: t.label })
            ] })
          ),
          nodes.map((node) => /* @__PURE__ */ jsx("g", { children: [
            node.isAccepting && /* @__PURE__ */ jsx(
              "circle",
              {
                cx: node.x,
                cy: node.y,
                r: acceptingNodeRadius,
                fill: "none",
                stroke: "black",
                "stroke-width": "1.5"
              }
            ),
            /* @__PURE__ */ jsx(
              "circle",
              {
                cx: node.x,
                cy: node.y,
                r: nodeRadius,
                fill: "white",
                stroke: "black",
                "stroke-width": "1.5"
              }
            ),
            /* @__PURE__ */ jsx(
              "text",
              {
                x: node.x,
                y: node.y,
                "font-size": "14",
                "text-anchor": "middle",
                "dominant-baseline": "middle",
                fill: "black",
                children: node.label
              }
            ),
            node.isInitial && /* @__PURE__ */ jsx(
              "path",
              {
                d: `M ${node.x - nodeRadius - 20} ${node.y} L ${node.x - nodeRadius} ${node.y}`,
                stroke: "black",
                "stroke-width": "1.5",
                fill: "none",
                "marker-end": "url(#arrowhead)"
              }
            )
          ] })),
          /* @__PURE__ */ jsx("defs", { children: /* @__PURE__ */ jsx("marker", { id: "arrowhead", markerWidth: "10", markerHeight: "10", refX: "5", refY: "3", orient: "auto", children: /* @__PURE__ */ jsx("polygon", { points: "0 0, 6 3, 0 6", fill: "black" }) }) })
        ]
      }
    );
  };
}

// app/lib/figures/table-renderer.ts
function assertNever(value) {
  throw new Error(`unreachable table figure: ${JSON.stringify(value)}`);
}
function buildTableConfig(data) {
  switch (data.type) {
    case "truthTable":
    case "dataTable":
      return {
        ariaLabel: data.type === "truthTable" ? "\u771F\u7406\u5024\u8868" : "Data table",
        columns: data.columns,
        rows: data.rows
      };
    case "huffmanTable":
      return {
        ariaLabel: "Huffman coding table",
        columns: [
          { key: "character", label: "\u6587\u5B57" },
          { key: "probability", label: "\u78BA\u7387" }
        ],
        rows: data.data.characters.map((character, index) => ({
          character,
          probability: data.data.probabilities[index]
        }))
      };
    case "linkedListTable":
      return {
        ariaLabel: "Linked list table",
        columns: [
          { key: "address", label: "\u30A2\u30C9\u30EC\u30B9" },
          { key: "data", label: "\u30C7\u30FC\u30BF" },
          { key: "pointer", label: "\u30DD\u30A4\u30F3\u30BF" }
        ],
        rows: data.entries.map((entry) => ({
          address: String(entry.address),
          data: entry.data,
          pointer: String(entry.pointer)
        }))
      };
    case "normalDistributionTable":
      return {
        ariaLabel: "Normal distribution table",
        columns: [
          { key: "u", label: "u" },
          { key: "probability", label: "\u78BA\u7387" }
        ],
        rows: data.entries.map((entry) => ({
          u: entry.u,
          probability: entry.probability
        }))
      };
    default:
      return assertNever(data);
  }
}

// app/ui/figures/TableRenderer.tsx
var tableWrapStyle = css({ width: "100%", overflowX: "auto" });
var figureTableStyle = css({
  maxWidth: "42rem",
  minWidth: "max-content",
  borderCollapse: "collapse",
  border: "2px solid #1f2937",
  "& th, & td": { border: "1px solid #1f2937", padding: "0.5rem 0.75rem", textAlign: "center" },
  "& th": { background: "#f3f4f6", fontWeight: 700 },
  "& td": { fontFamily: "var(--font-mono)" }
});
function TableRenderer(handle) {
  return () => {
    const { figureData } = handle.props;
    const config2 = buildTableConfig(figureData);
    return /* @__PURE__ */ jsx("div", { mix: tableWrapStyle, children: /* @__PURE__ */ jsx("table", { "aria-label": config2.ariaLabel, mix: figureTableStyle, children: [
      /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsx("tr", { children: config2.columns.map((column) => /* @__PURE__ */ jsx("th", { children: column.label })) }) }),
      /* @__PURE__ */ jsx("tbody", { children: config2.rows.map((row) => /* @__PURE__ */ jsx("tr", { children: config2.columns.map((column) => /* @__PURE__ */ jsx("td", { children: String(row[column.key]) })) })) })
    ] }) });
  };
}

// app/ui/figures/Figure.tsx
function assertNever2(value) {
  throw new Error(`Unknown figure type: ${JSON.stringify(value)}`);
}
function Figure(handle) {
  return () => {
    const { data, mode = "responsive" } = handle.props;
    switch (data.type) {
      case "stateDiagram":
        return /* @__PURE__ */ jsx(StateDiagram, { nodes: data.nodes, transitions: data.transitions });
      case "binaryTree":
        return /* @__PURE__ */ jsx(BinaryTree, { root: data.root, width: data.width, height: data.height });
      case "parityCheck":
        return /* @__PURE__ */ jsx(ParityCheck, { data: data.data });
      case "logicCircuit":
        return /* @__PURE__ */ jsx(LogicCircuit, { circuit: data, mode });
      case "flowchart":
        return /* @__PURE__ */ jsx(
          Flowchart,
          {
            nodes: data.nodes,
            edges: data.edges,
            width: data.width,
            height: data.height
          }
        );
      case "dataTable":
      case "truthTable":
      case "huffmanTable":
      case "linkedListTable":
      case "normalDistributionTable":
        return /* @__PURE__ */ jsx(TableRenderer, { figureData: data });
      default:
        return assertNever2(data);
    }
  };
}

// app/features/challenge/ui/question-content.tsx
var bodyStyle2 = css({
  "& p": { whiteSpace: "pre-wrap", lineHeight: 1.9 }
});
var headingStyle = css({
  fontSize: "0.95rem",
  letterSpacing: "0.06em",
  color: "var(--color-text-muted)",
  margin: "0 0 0.25rem"
});
var optionListStyle = css({
  listStyle: "none",
  margin: "1rem 0",
  padding: 0,
  display: "grid",
  gap: "0.375rem"
});
var optionStyle = css({
  border: "1px solid var(--color-border)",
  borderRadius: "0.375rem",
  padding: "0.5rem 0.75rem"
});
function QuestionContent(handle) {
  return () => {
    const { question } = handle.props;
    return /* @__PURE__ */ jsx("div", { mix: bodyStyle2, children: [
      /* @__PURE__ */ jsx("h3", { mix: headingStyle, children: [
        "\u554F",
        question.number
      ] }),
      /* @__PURE__ */ jsx("p", { children: question.text }),
      question.options ? /* @__PURE__ */ jsx("ul", { mix: optionListStyle, children: question.options.map((option) => /* @__PURE__ */ jsx("li", { mix: optionStyle, children: [
        /* @__PURE__ */ jsx("strong", { children: option.label }),
        ": ",
        option.value
      ] }, option.label)) }) : null,
      question.figureDescription ? /* @__PURE__ */ jsx("p", { children: question.figureDescription }) : null,
      question.figureData ? /* @__PURE__ */ jsx(Figure, { data: question.figureData }) : null
    ] });
  };
}

// app/features/challenge/ui/exam-player.tsx
var shellStyle = css({
  position: "relative",
  background: "var(--color-bg-card)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-card)",
  overflow: "hidden"
});
var messageStyle = css({ padding: "2rem 1rem", textAlign: "center" });
var resumeStyle = css({
  maxWidth: "32rem",
  margin: "0 auto",
  padding: "1.5rem",
  background: "var(--color-bg-card)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-card)"
});
var eyebrowStyle2 = css({
  margin: "0 0 0.25rem",
  fontSize: "0.8rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--color-text-muted)"
});
var resumeActionsStyle = css({
  display: "flex",
  gap: "0.75rem",
  flexWrap: "wrap",
  marginTop: "1rem"
});
var workspaceStyle = css({ padding: "1.25rem" });
var questionStyle = css({ display: "grid", gap: "0.25rem" });
var ExamPlayer = clientEntry(
  "/assets/client.js#ExamPlayer",
  function ExamPlayerEntry(handle) {
    const props = handle.props;
    const questionById = new Map(props.questions.map((question) => [question.id, question]));
    const questionIndexById = new Map(
      props.questions.map((question, index) => [question.id, index])
    );
    const session = resolveInitialPlayerSession(props);
    let state = session.state;
    let phase = session.phase;
    let resultPayload = session.resultPayload;
    let resultHistory = session.resultHistory;
    let solutionOpen = false;
    let questionListOpen = false;
    const syncMessage = null;
    const runtime = {
      running: false,
      lastSample: null,
      currentQuestionId: state ? state.questionIds[state.currentIndex] : void 0
    };
    const now = () => systemClock.nowEpochMilliseconds();
    const currentQuestionId = () => state?.questionIds[state.currentIndex];
    const currentQuestion = () => {
      const id = currentQuestionId();
      return id ? questionById.get(id) : void 0;
    };
    const navigation = () => state ? getNavigationPosition(
      props.mode,
      currentQuestionId(),
      state,
      props.questions,
      (id) => id ? questionIndexById.get(id) ?? 0 : 0
    ) : { currentQuestionIndex: 0, navigationLength: props.questions.length };
    const persist = () => {
      if (state) {
        saveActiveChallenge(state);
      }
    };
    const commit = (next) => {
      const sampled = sampleChallengeTimer(next, runtime, now());
      state = sampled.state;
      persist();
    };
    const sample = () => {
      if (!state) {
        return;
      }
      const sampled = sampleChallengeTimer(state, runtime, now());
      state = sampled.state;
      persist();
    };
    const openAnswer = () => {
      solutionOpen = true;
      if (state) {
        const id = currentQuestionId();
        if (id) {
          state = challengeReducer(state, { type: "REVEAL_QUESTION", questionId: id });
          persist();
        }
      }
    };
    const toggleAnswer = () => {
      if (solutionOpen) {
        solutionOpen = false;
      } else {
        openAnswer();
      }
      void handle.update();
    };
    const toggleTimer = () => {
      sample();
      if (runtime.running) {
        runtime.running = false;
      } else {
        runtime.running = true;
        runtime.lastSample = now();
      }
      void handle.update();
    };
    const judge = (judgment) => {
      if (!state) {
        return;
      }
      const id = currentQuestionId();
      if (!id) {
        return;
      }
      sample();
      if (!state) {
        return;
      }
      const judged = challengeReducer(state, {
        type: "JUDGE_QUESTION",
        questionId: id,
        judgment,
        answerCreatedAt: now()
      });
      solutionOpen = false;
      commit(judged);
      void handle.update();
    };
    const selectIndex = (index, listed) => {
      if (!state) {
        return;
      }
      sample();
      if (!state) {
        return;
      }
      const targetId = listed ? state.questionIds[index] ?? currentQuestionId() : props.questions[index]?.id ?? currentQuestionId();
      if (!(targetId && state)) {
        return;
      }
      const moveIndex = listed ? index : questionIndexById.get(targetId) ?? 0;
      state = challengeReducer(state, { type: "MOVE_TO", index: moveIndex });
      resetTimerRuntimeInPlace(runtime, currentQuestionId());
      runtime.running = true;
      runtime.lastSample = now();
      solutionOpen = false;
      questionListOpen = false;
      persist();
      if (props.mode === "question") {
        replaceQuestionInUrl(targetId);
      }
      void handle.update();
    };
    const move = (offset) => {
      const { currentQuestionIndex, navigationLength } = navigation();
      const next = currentQuestionIndex + offset;
      if (next < 0 || next >= navigationLength) {
        return;
      }
      selectIndex(next, props.mode === "question");
      void handle.update();
    };
    const finish = () => {
      if (!state) {
        return;
      }
      sample();
      if (!state) {
        return;
      }
      const updatedAt = now();
      const completed = challengeReducer(state, { type: "COMPLETE", updatedAt });
      const archived = archiveCompletedChallenge(completed, updatedAt);
      if (!archived) {
        return;
      }
      const payload = archived.payload;
      resultPayload = payload;
      resultHistory = filterChallengeHistory(
        readCompletedChallenges(),
        props.examId,
        props.mode,
        props.mode === "question" ? payload.answers[0]?.questionId ?? props.requestedQuestionId : props.requestedQuestionId
      );
      phase = "result";
      solutionOpen = false;
      if (typeof window !== "undefined") {
        replaceChallengeView("result", payload.challengeId);
      }
      void handle.update();
    };
    const retry = () => {
      if (typeof window === "undefined") {
        return;
      }
      replaceChallengeView("player");
      const reload = resolveInitialPlayerSession(props);
      state = reload.state;
      phase = reload.phase;
      resultPayload = null;
      resultHistory = [];
      solutionOpen = false;
      resetTimerRuntimeInPlace(runtime, currentQuestionId());
      runtime.running = true;
      runtime.lastSample = now();
      persist();
      void handle.update();
    };
    const resume = () => {
      phase = "player";
      runtime.running = true;
      runtime.lastSample = now();
      void handle.update();
    };
    return () => {
      if (!state && typeof window === "undefined") {
        return /* @__PURE__ */ jsx(ExamPlayerPreview, { props });
      }
      if (phase === "result" && resultPayload) {
        return /* @__PURE__ */ jsx(
          ChallengeResultView,
          {
            payload: resultPayload,
            history: resultHistory.length > 0 ? resultHistory : [resultPayload],
            questions: props.questions,
            mode: props.mode,
            unitId: props.unitId,
            year: props.year,
            syncMessage,
            onRetry: retry
          }
        );
      }
      if (phase === "missing") {
        return /* @__PURE__ */ jsx("div", { mix: messageStyle, children: [
          /* @__PURE__ */ jsx("p", { children: "\u3053\u306E\u7D50\u679C\u306F\u7AEF\u672B\u5185\u306B\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3067\u3057\u305F\u3002" }),
          /* @__PURE__ */ jsx("a", { mix: primaryButtonStyle, href: `/${props.unitId}/${props.year}`, children: "\u554F\u984C\u4E00\u89A7\u3078\u623B\u308B" })
        ] });
      }
      if (!state) {
        return /* @__PURE__ */ jsx(ExamPlayerPreview, { props });
      }
      if (phase === "resume") {
        return /* @__PURE__ */ jsx("section", { mix: resumeStyle, "aria-labelledby": "exam-resume-title", children: [
          /* @__PURE__ */ jsx("p", { mix: eyebrowStyle2, children: "\u7D9A\u304D\u304C\u3042\u308A\u307E\u3059" }),
          /* @__PURE__ */ jsx("h2", { id: "exam-resume-title", children: "\u524D\u56DE\u306E\u8A66\u884C\u3092\u3069\u3046\u3057\u307E\u3059\u304B\uFF1F" }),
          /* @__PURE__ */ jsx("div", { mix: resumeActionsStyle, children: [
            /* @__PURE__ */ jsx("button", { type: "button", mix: [primaryButtonStyle, on("click", resume)], children: "\u7D9A\u304D\u304B\u3089" }),
            /* @__PURE__ */ jsx("button", { type: "button", mix: [quietButtonStyle, on("click", retry)], children: "\u6700\u521D\u304B\u3089" })
          ] })
        ] });
      }
      const question = currentQuestion();
      if (!question) {
        return /* @__PURE__ */ jsx("div", { mix: messageStyle, children: "\u554F\u984C\u3092\u8868\u793A\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002" });
      }
      const { currentQuestionIndex, navigationLength } = navigation();
      const markdown = questionToMarkdown(question, { includeSolution: false });
      const currentJudgment = state.judgments[question.id];
      return /* @__PURE__ */ jsx(
        "section",
        {
          mix: shellStyle,
          "aria-label": props.mode === "exam" ? "\u5C0F\u30C6\u30B9\u30C8\u30D7\u30EC\u30A4\u30E4\u30FC" : "\u30BF\u30A4\u30E0\u30A2\u30BF\u30C3\u30AF\u30D7\u30EC\u30A4\u30E4\u30FC",
          children: [
            /* @__PURE__ */ jsx(
              PlayerHeader,
              {
                playerTitle: props.playerTitle,
                questions: props.questions,
                currentQuestionIndex,
                onOpenQuestionList: () => {
                  questionListOpen = true;
                  void handle.update();
                },
                onSelectQuestion: (index) => selectIndex(index, false)
              }
            ),
            /* @__PURE__ */ jsx(
              PlayerList,
              {
                state,
                questions: props.questions,
                mode: props.mode,
                open: questionListOpen,
                onClose: () => {
                  questionListOpen = false;
                  void handle.update();
                },
                onSelect: (index) => selectIndex(index, true)
              }
            ),
            /* @__PURE__ */ jsx("div", { mix: workspaceStyle, children: [
              /* @__PURE__ */ jsx("div", { mix: questionStyle, children: [
                /* @__PURE__ */ jsx(QuestionContent, { question }),
                /* @__PURE__ */ jsx(
                  ChallengeTimerDisplay,
                  {
                    mode: props.mode,
                    totalElapsedMs: Object.values(state.questionElapsedMs).reduce(
                      (sum, value) => sum + (value ?? 0),
                      0
                    ),
                    questionElapsedMs: state.questionElapsedMs[question.id] ?? 0,
                    timerRunning: runtime.running,
                    timerStartedAt: runtime.running ? runtime.lastSample : null
                  }
                ),
                /* @__PURE__ */ jsx(
                  QuestionActions,
                  {
                    copyText: markdown,
                    answerOpen: solutionOpen,
                    onToggleAnswer: toggleAnswer,
                    timerRunning: runtime.running,
                    onToggleTimer: toggleTimer
                  }
                ),
                /* @__PURE__ */ jsx(
                  AnswerPanel,
                  {
                    question,
                    isOpen: solutionOpen,
                    judgment: currentJudgment,
                    onJudge: judge
                  }
                )
              ] }),
              /* @__PURE__ */ jsx(
                PlayerEdgeNavigation,
                {
                  showPrevious: navigationLength > 1,
                  isFirst: currentQuestionIndex === 0,
                  isLast: currentQuestionIndex === navigationLength - 1,
                  canFinish: isChallengeComplete(state),
                  onPrevious: () => move(-1),
                  onNext: () => move(1),
                  onFinish: finish
                }
              )
            ] })
          ]
        }
      );
    };
  }
);
function ExamPlayerPreview(handle) {
  return () => {
    const { props } = handle.props;
    const question = props.questions[0];
    if (!question) {
      return /* @__PURE__ */ jsx("div", { mix: shellStyle, "aria-hidden": "true" });
    }
    return /* @__PURE__ */ jsx(
      "section",
      {
        mix: shellStyle,
        "aria-label": props.mode === "exam" ? "\u5C0F\u30C6\u30B9\u30C8\u30D7\u30EC\u30A4\u30E4\u30FC" : "\u30BF\u30A4\u30E0\u30A2\u30BF\u30C3\u30AF\u30D7\u30EC\u30A4\u30E4\u30FC",
        children: [
          /* @__PURE__ */ jsx(
            PlayerHeader,
            {
              playerTitle: props.playerTitle,
              questions: props.questions,
              currentQuestionIndex: 0,
              disabled: true,
              onOpenQuestionList: () => {
              },
              onSelectQuestion: () => {
              }
            }
          ),
          /* @__PURE__ */ jsx("div", { mix: workspaceStyle, children: /* @__PURE__ */ jsx("div", { mix: questionStyle, children: [
            /* @__PURE__ */ jsx(QuestionContent, { question }),
            /* @__PURE__ */ jsx(
              ChallengeTimerDisplay,
              {
                mode: props.mode,
                totalElapsedMs: 0,
                questionElapsedMs: 0,
                timerRunning: false,
                timerStartedAt: null
              }
            )
          ] }) })
        ]
      }
    );
  };
}

// node_modules/neverthrow/dist/index.es.js
var defaultErrorConfig = {
  withStackTrace: false
};
var createNeverThrowError = (message, result, config2 = defaultErrorConfig) => {
  const data = result.isOk() ? { type: "Ok", value: result.value } : { type: "Err", value: result.error };
  const maybeStack = config2.withStackTrace ? new Error().stack : void 0;
  return {
    data,
    message,
    stack: maybeStack
  };
};
function __awaiter(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve) {
      resolve(value);
    });
  }
  return new (P || (P = Promise))(function(resolve, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
}
function __values(o) {
  var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
  if (m) return m.call(o);
  if (o && typeof o.length === "number") return {
    next: function() {
      if (o && i >= o.length) o = void 0;
      return { value: o && o[i++], done: !o };
    }
  };
  throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
}
function __await(v) {
  return this instanceof __await ? (this.v = v, this) : new __await(v);
}
function __asyncGenerator(thisArg, _arguments, generator) {
  if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
  var g = generator.apply(thisArg, _arguments || []), i, q = [];
  return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function() {
    return this;
  }, i;
  function awaitReturn(f) {
    return function(v) {
      return Promise.resolve(v).then(f, reject);
    };
  }
  function verb(n, f) {
    if (g[n]) {
      i[n] = function(v) {
        return new Promise(function(a, b) {
          q.push([n, v, a, b]) > 1 || resume(n, v);
        });
      };
      if (f) i[n] = f(i[n]);
    }
  }
  function resume(n, v) {
    try {
      step(g[n](v));
    } catch (e) {
      settle(q[0][3], e);
    }
  }
  function step(r) {
    r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r);
  }
  function fulfill(value) {
    resume("next", value);
  }
  function reject(value) {
    resume("throw", value);
  }
  function settle(f, v) {
    if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]);
  }
}
function __asyncDelegator(o) {
  var i, p;
  return i = {}, verb("next"), verb("throw", function(e) {
    throw e;
  }), verb("return"), i[Symbol.iterator] = function() {
    return this;
  }, i;
  function verb(n, f) {
    i[n] = o[n] ? function(v) {
      return (p = !p) ? { value: __await(o[n](v)), done: false } : f ? f(v) : v;
    } : f;
  }
}
function __asyncValues(o) {
  if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
  var m = o[Symbol.asyncIterator], i;
  return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function() {
    return this;
  }, i);
  function verb(n) {
    i[n] = o[n] && function(v) {
      return new Promise(function(resolve, reject) {
        v = o[n](v), settle(resolve, reject, v.done, v.value);
      });
    };
  }
  function settle(resolve, reject, d, v) {
    Promise.resolve(v).then(function(v2) {
      resolve({ value: v2, done: d });
    }, reject);
  }
}
var ResultAsync = class _ResultAsync {
  constructor(res) {
    this._promise = res;
  }
  static fromSafePromise(promise) {
    const newPromise = promise.then((value) => new Ok(value));
    return new _ResultAsync(newPromise);
  }
  static fromPromise(promise, errorFn) {
    const newPromise = promise.then((value) => new Ok(value)).catch((e) => new Err(errorFn(e)));
    return new _ResultAsync(newPromise);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromThrowable(fn, errorFn) {
    return (...args) => {
      return new _ResultAsync((() => __awaiter(this, void 0, void 0, function* () {
        try {
          return new Ok(yield fn(...args));
        } catch (error) {
          return new Err(errorFn ? errorFn(error) : error);
        }
      }))());
    };
  }
  static combine(asyncResultList) {
    return combineResultAsyncList(asyncResultList);
  }
  static combineWithAllErrors(asyncResultList) {
    return combineResultAsyncListWithAllErrors(asyncResultList);
  }
  map(f) {
    return new _ResultAsync(this._promise.then((res) => __awaiter(this, void 0, void 0, function* () {
      if (res.isErr()) {
        return new Err(res.error);
      }
      return new Ok(yield f(res.value));
    })));
  }
  andThrough(f) {
    return new _ResultAsync(this._promise.then((res) => __awaiter(this, void 0, void 0, function* () {
      if (res.isErr()) {
        return new Err(res.error);
      }
      const newRes = yield f(res.value);
      if (newRes.isErr()) {
        return new Err(newRes.error);
      }
      return new Ok(res.value);
    })));
  }
  andTee(f) {
    return new _ResultAsync(this._promise.then((res) => __awaiter(this, void 0, void 0, function* () {
      if (res.isErr()) {
        return new Err(res.error);
      }
      try {
        yield f(res.value);
      } catch (e) {
      }
      return new Ok(res.value);
    })));
  }
  orTee(f) {
    return new _ResultAsync(this._promise.then((res) => __awaiter(this, void 0, void 0, function* () {
      if (res.isOk()) {
        return new Ok(res.value);
      }
      try {
        yield f(res.error);
      } catch (e) {
      }
      return new Err(res.error);
    })));
  }
  mapErr(f) {
    return new _ResultAsync(this._promise.then((res) => __awaiter(this, void 0, void 0, function* () {
      if (res.isOk()) {
        return new Ok(res.value);
      }
      return new Err(yield f(res.error));
    })));
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
  andThen(f) {
    return new _ResultAsync(this._promise.then((res) => {
      if (res.isErr()) {
        return new Err(res.error);
      }
      const newValue = f(res.value);
      return newValue instanceof _ResultAsync ? newValue._promise : newValue;
    }));
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
  orElse(f) {
    return new _ResultAsync(this._promise.then((res) => __awaiter(this, void 0, void 0, function* () {
      if (res.isErr()) {
        return f(res.error);
      }
      return new Ok(res.value);
    })));
  }
  match(ok2, _err) {
    return this._promise.then((res) => res.match(ok2, _err));
  }
  unwrapOr(t) {
    return this._promise.then((res) => res.unwrapOr(t));
  }
  /**
   * @deprecated will be removed in 9.0.0.
   *
   * You can use `safeTry` without this method.
   * @example
   * ```typescript
   * safeTry(async function* () {
   *   const okValue = yield* yourResult
   * })
   * ```
   * Emulates Rust's `?` operator in `safeTry`'s body. See also `safeTry`.
   */
  safeUnwrap() {
    return __asyncGenerator(this, arguments, function* safeUnwrap_1() {
      return yield __await(yield __await(yield* __asyncDelegator(__asyncValues(yield __await(this._promise.then((res) => res.safeUnwrap()))))));
    });
  }
  // Makes ResultAsync implement PromiseLike<Result>
  then(successCallback, failureCallback) {
    return this._promise.then(successCallback, failureCallback);
  }
  [Symbol.asyncIterator]() {
    return __asyncGenerator(this, arguments, function* _a2() {
      const result = yield __await(this._promise);
      if (result.isErr()) {
        yield yield __await(errAsync(result.error));
      }
      return yield __await(result.value);
    });
  }
};
function okAsync(value) {
  return new ResultAsync(Promise.resolve(new Ok(value)));
}
function errAsync(err2) {
  return new ResultAsync(Promise.resolve(new Err(err2)));
}
var fromPromise = ResultAsync.fromPromise;
var fromSafePromise = ResultAsync.fromSafePromise;
var fromAsyncThrowable = ResultAsync.fromThrowable;
var combineResultList = (resultList) => {
  let acc = ok([]);
  for (const result of resultList) {
    if (result.isErr()) {
      acc = err(result.error);
      break;
    } else {
      acc.map((list) => list.push(result.value));
    }
  }
  return acc;
};
var combineResultAsyncList = (asyncResultList) => ResultAsync.fromSafePromise(Promise.all(asyncResultList)).andThen(combineResultList);
var combineResultListWithAllErrors = (resultList) => {
  let acc = ok([]);
  for (const result of resultList) {
    if (result.isErr() && acc.isErr()) {
      acc.error.push(result.error);
    } else if (result.isErr() && acc.isOk()) {
      acc = err([result.error]);
    } else if (result.isOk() && acc.isOk()) {
      acc.value.push(result.value);
    }
  }
  return acc;
};
var combineResultAsyncListWithAllErrors = (asyncResultList) => ResultAsync.fromSafePromise(Promise.all(asyncResultList)).andThen(combineResultListWithAllErrors);
var Result;
(function(Result2) {
  function fromThrowable2(fn, errorFn) {
    return (...args) => {
      try {
        const result = fn(...args);
        return ok(result);
      } catch (e) {
        return err(errorFn ? errorFn(e) : e);
      }
    };
  }
  Result2.fromThrowable = fromThrowable2;
  function combine(resultList) {
    return combineResultList(resultList);
  }
  Result2.combine = combine;
  function combineWithAllErrors(resultList) {
    return combineResultListWithAllErrors(resultList);
  }
  Result2.combineWithAllErrors = combineWithAllErrors;
})(Result || (Result = {}));
function ok(value) {
  return new Ok(value);
}
function err(err2) {
  return new Err(err2);
}
var Ok = class {
  constructor(value) {
    this.value = value;
  }
  isOk() {
    return true;
  }
  isErr() {
    return !this.isOk();
  }
  map(f) {
    return ok(f(this.value));
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  mapErr(_f) {
    return ok(this.value);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
  andThen(f) {
    return f(this.value);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
  andThrough(f) {
    return f(this.value).map((_value) => this.value);
  }
  andTee(f) {
    try {
      f(this.value);
    } catch (e) {
    }
    return ok(this.value);
  }
  orTee(_f) {
    return ok(this.value);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
  orElse(_f) {
    return ok(this.value);
  }
  asyncAndThen(f) {
    return f(this.value);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
  asyncAndThrough(f) {
    return f(this.value).map(() => this.value);
  }
  asyncMap(f) {
    return ResultAsync.fromSafePromise(f(this.value));
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  unwrapOr(_v) {
    return this.value;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  match(ok2, _err) {
    return ok2(this.value);
  }
  safeUnwrap() {
    const value = this.value;
    return (function* () {
      return value;
    })();
  }
  _unsafeUnwrap(_) {
    return this.value;
  }
  _unsafeUnwrapErr(config2) {
    throw createNeverThrowError("Called `_unsafeUnwrapErr` on an Ok", this, config2);
  }
  // eslint-disable-next-line @typescript-eslint/no-this-alias, require-yield
  *[Symbol.iterator]() {
    return this.value;
  }
};
var Err = class {
  constructor(error) {
    this.error = error;
  }
  isOk() {
    return false;
  }
  isErr() {
    return !this.isOk();
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  map(_f) {
    return err(this.error);
  }
  mapErr(f) {
    return err(f(this.error));
  }
  andThrough(_f) {
    return err(this.error);
  }
  andTee(_f) {
    return err(this.error);
  }
  orTee(f) {
    try {
      f(this.error);
    } catch (e) {
    }
    return err(this.error);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
  andThen(_f) {
    return err(this.error);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
  orElse(f) {
    return f(this.error);
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  asyncAndThen(_f) {
    return errAsync(this.error);
  }
  asyncAndThrough(_f) {
    return errAsync(this.error);
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  asyncMap(_f) {
    return errAsync(this.error);
  }
  unwrapOr(v) {
    return v;
  }
  match(_ok, err2) {
    return err2(this.error);
  }
  safeUnwrap() {
    const error = this.error;
    return (function* () {
      yield err(error);
      throw new Error("Do not use this generator out of `safeTry`");
    })();
  }
  _unsafeUnwrap(config2) {
    throw createNeverThrowError("Called `_unsafeUnwrap` on an Err", this, config2);
  }
  _unsafeUnwrapErr(_) {
    return this.error;
  }
  *[Symbol.iterator]() {
    const self = this;
    yield self;
    return self;
  }
};
var fromThrowable = Result.fromThrowable;

// app/features/progress/client.ts
var JSON_HEADERS = { "content-type": "application/json" };
var progressClient = {
  links: {
    $post: () => fetch("/progress/links", { method: "POST" })
  },
  index: {
    $delete: (init) => fetch("/progress", { method: "DELETE", headers: init.header })
  },
  sync: {
    $post: (init) => fetch("/progress/sync", {
      method: "POST",
      headers: { ...JSON_HEADERS, ...init.header },
      body: JSON.stringify(init.json)
    })
  },
  challenges: {
    $post: (init) => fetch("/progress/challenges", {
      method: "POST",
      headers: { ...JSON_HEADERS, ...init.header },
      body: JSON.stringify(init.json)
    })
  }
};

// app/features/challenge/api.ts
function parseResponse(body) {
  if (!body || typeof body !== "object" || !("challenges" in body) || !Array.isArray(body.challenges)) {
    return null;
  }
  return body.challenges.every(isCompletedChallengePayload) ? [...body.challenges] : null;
}
function syncChallenges(key, local) {
  return ResultAsync.fromPromise(
    progressClient.challenges.$post({
      json: {
        challenges: local.map((challenge) => ({
          ...challenge,
          answers: challenge.answers.map((answer) => ({ ...answer }))
        }))
      },
      header: { "x-sync-key": key }
    }),
    (cause) => ({ kind: "RequestFailed", cause })
  ).andThen((response) => {
    if (!response.ok) {
      if (response.status === 404) {
        return err({ kind: "InvalidSyncLink" });
      }
      if (response.status === 409) {
        return err({ kind: "Conflict" });
      }
      return err({ kind: "RequestFailed", cause: response });
    }
    return ResultAsync.fromPromise(
      response.json(),
      (cause) => ({ kind: "InvalidResponse", cause })
    ).andThen((body) => {
      const parsed = parseResponse(body);
      return parsed ? okAsync([...mergeCompletedChallenges(local, parsed)]) : err({ kind: "InvalidResponse" });
    });
  });
}

// app/lib/progress.ts
function mergeLatestProgressEntries(entries) {
  return Array.from(Map.groupBy(entries, (entry) => entry.questionId).values(), (duplicates) => {
    const first = duplicates[0];
    if (!first) {
      throw new Error("A grouped progress list cannot be empty");
    }
    const [latest, earliestCreatedAt] = duplicates.reduce(
      ([currentLatest, currentCreatedAt], entry) => [
        entry.updatedAt > currentLatest.updatedAt ? entry : currentLatest,
        entry.createdAt < currentCreatedAt ? entry.createdAt : currentCreatedAt
      ],
      [first, first.createdAt]
    );
    return latest.createdAt === earliestCreatedAt ? latest : { ...latest, createdAt: earliestCreatedAt };
  });
}

// app/features/progress/model.ts
function mergeProgressEntries(local, remote) {
  return sortNewestFirst(mergeLatestProgressEntries([...local, ...remote]));
}
function toProgressMap(entries) {
  return Object.fromEntries(entries.map((entry) => [entry.questionId, entry]));
}

// app/features/progress/api.ts
function createSyncLink() {
  return progressClient.links.$post();
}
function deleteRemoteProgress(key) {
  return progressClient.index.$delete({ header: { "x-sync-key": key } });
}
function syncProgress(key, local) {
  return ResultAsync.fromPromise(
    progressClient.sync.$post({ json: { entries: local }, header: { "x-sync-key": key } }),
    (cause) => ({ kind: "RequestFailed", cause })
  ).andThen((response) => {
    if (!response.ok) {
      return err(
        response.status === 404 ? { kind: "InvalidSyncLink" } : { kind: "RequestFailed", cause: response }
      );
    }
    return ResultAsync.fromPromise(
      response.json(),
      (cause) => ({ kind: "InvalidResponse", cause })
    ).map((body) => mergeProgressEntries(local, body.entries));
  });
}

// app/features/progress/storage.ts
var PROGRESS_STORAGE_KEY = "fit-question-progress-v2";
var LEGACY_PROGRESS_STORAGE_KEY = "fit-question-progress-v1";
var SYNC_KEY_STORAGE_KEY = "fit-sync-key-v1";
var PROGRESS_CHANGE_EVENT = "fit:progress-change";
var SYNC_KEY_CHANGE_EVENT = "fit:sync-key-change";
function notifyStorageChange(eventName) {
  window.dispatchEvent(new Event(eventName));
}
function readProgressSnapshot() {
  try {
    return localStorage.getItem(PROGRESS_STORAGE_KEY) ?? localStorage.getItem(LEGACY_PROGRESS_STORAGE_KEY);
  } catch {
    return null;
  }
}
function readSyncKey() {
  try {
    const parsed = SyncKeySchema.safeParse(localStorage.getItem(SYNC_KEY_STORAGE_KEY));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
function saveSyncKey(key) {
  try {
    localStorage.setItem(SYNC_KEY_STORAGE_KEY, key);
    notifyStorageChange(SYNC_KEY_CHANGE_EVENT);
    return { kind: "StorageMutationSuccess" };
  } catch (cause) {
    return { kind: "StorageMutationError", operation: "SaveSyncKey", cause };
  }
}
function removeSyncKey() {
  try {
    localStorage.removeItem(SYNC_KEY_STORAGE_KEY);
    notifyStorageChange(SYNC_KEY_CHANGE_EVENT);
    return { kind: "StorageMutationSuccess" };
  } catch (cause) {
    return { kind: "StorageMutationError", operation: "RemoveSyncKey", cause };
  }
}
function parseProgressSnapshot(snapshot) {
  try {
    const parsed = ProgressSnapshotSchema.safeParse(JSON.parse(snapshot ?? "{}"));
    if (!parsed.success) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(parsed.data).flatMap(([key, value]) => {
        const entry = ProgressEntrySchema.safeParse(value);
        if (entry.success) {
          return [[key, entry.data]];
        }
        if (!(isRecord3(value) && "revealedAt" in value)) {
          return [];
        }
        const timestamp = EpochMillisecondsSchema.safeParse(value.revealedAt);
        const migrated = ProgressEntrySchema.safeParse({
          questionId: value.questionId ?? key,
          unitId: value.unitId,
          createdAt: timestamp.success ? timestamp.data : void 0,
          updatedAt: timestamp.success ? timestamp.data : void 0
        });
        return migrated.success ? [[key, migrated.data]] : [];
      })
    );
  } catch {
    return {};
  }
}
function readProgress() {
  return parseProgressSnapshot(readProgressSnapshot());
}
function saveProgressEntries(entries) {
  localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(toProgressMap(entries)));
  notifyStorageChange(PROGRESS_CHANGE_EVENT);
}
function mergeStoredProgress(entries) {
  try {
    saveProgressEntries(mergeProgressEntries(Object.values(readProgress()), entries));
  } catch {
  }
}

// app/features/progress/ui/records-view.tsx
var recordsSectionStyle = css({
  marginTop: "1.5rem",
  padding: "1rem 1.25rem",
  background: "var(--color-bg-card)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-card)",
  "& h2": { marginTop: 0, fontSize: "1.05rem", color: "var(--color-primary)" },
  "& ul": { listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.25rem" },
  "& li": { display: "flex", justifyContent: "space-between", gap: "0.75rem" }
});
var recordsActionsStyle = css({ display: "flex", gap: "0.5rem", flexWrap: "wrap" });
var recordsStatusStyle = css({
  marginTop: "0.5rem",
  fontSize: "0.85rem",
  color: "var(--color-text-muted)"
});
var RecordsView = clientEntry(
  "/assets/client.js#RecordsView",
  function RecordsViewEntry(handle) {
    const read = () => {
      const progress = Object.values(readProgress()).toSorted(
        (left, right) => right.updatedAt - left.updatedAt
      );
      const challenges = readChallengeHistory();
      return { progress, challenges };
    };
    let status = { kind: "idle", message: "" };
    let view = read();
    const refresh = () => {
      view = read();
    };
    const runSync = async () => {
      const key = readSyncKey();
      if (!key) {
        return;
      }
      status = { kind: "busy", message: "\u540C\u671F\u4E2D\u2026" };
      await handle.update();
      const progressResult = await syncProgress(key, view.progress);
      if (progressResult.isErr()) {
        status = { kind: "error", message: "\u9032\u6357\u3092\u540C\u671F\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F" };
        await handle.update();
        return;
      }
      mergeStoredProgress(progressResult.value);
      const completed = view.challenges.filter((snapshot) => snapshot.status === "completed");
      const challengeResult = await syncChallenges(
        key,
        completed.map((snapshot) => snapshotToPayload(snapshot)).filter((payload) => payload !== null)
      );
      status = challengeResult.isErr() ? { kind: "error", message: "\u5C0F\u30C6\u30B9\u30C8\u7D50\u679C\u3092\u540C\u671F\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F" } : { kind: "ok", message: "\u540C\u671F\u3057\u307E\u3057\u305F" };
      refresh();
      await handle.update();
    };
    const createLink = async () => {
      status = { kind: "busy", message: "\u30EA\u30F3\u30AF\u3092\u4F5C\u6210\u4E2D\u2026" };
      await handle.update();
      const response = await createSyncLink();
      if (!response.ok) {
        status = { kind: "error", message: "\u30EA\u30F3\u30AF\u3092\u4F5C\u6210\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F" };
        await handle.update();
        return;
      }
      const body = await response.json();
      if (typeof body.key !== "string") {
        status = { kind: "error", message: "\u30EA\u30F3\u30AF\u306E\u5F62\u5F0F\u304C\u6B63\u3057\u304F\u3042\u308A\u307E\u305B\u3093" };
        await handle.update();
        return;
      }
      const result = saveSyncKey(body.key);
      status = result.kind === "StorageMutationSuccess" ? { kind: "ok", message: "\u3053\u306E\u7AEF\u672B\u306B\u540C\u671F\u30EA\u30F3\u30AF\u3092\u4FDD\u5B58\u3057\u307E\u3057\u305F" } : { kind: "error", message: "\u4FDD\u5B58\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F" };
      await handle.update();
    };
    const removeLink = async () => {
      const key = readSyncKey();
      if (key) {
        await deleteRemoteProgress(key);
      }
      removeSyncKey();
      status = { kind: "ok", message: "\u540C\u671F\u30EA\u30F3\u30AF\u3092\u524A\u9664\u3057\u307E\u3057\u305F" };
      await handle.update();
    };
    const copyLink = async () => {
      const key = readSyncKey();
      if (key && typeof navigator !== "undefined") {
        await navigator.clipboard.writeText(key);
        status = { kind: "ok", message: "\u540C\u671F\u30EA\u30F3\u30AF\u3092\u30B3\u30D4\u30FC\u3057\u307E\u3057\u305F" };
        await handle.update();
      }
    };
    return () => {
      const syncKey = readSyncKey();
      return /* @__PURE__ */ jsx("section", { children: [
        /* @__PURE__ */ jsx("header", { mix: recordsSectionStyle, children: [
          /* @__PURE__ */ jsx("h2", { children: "\u540C\u671F" }),
          syncKey ? /* @__PURE__ */ jsx(Fragment, { children: [
            /* @__PURE__ */ jsx("p", { children: "\u3053\u306E\u7AEF\u672B\u306F\u540C\u671F\u30EA\u30F3\u30AF\u3067\u4FDD\u8B77\u3055\u308C\u3066\u3044\u307E\u3059\u3002\u30EA\u30F3\u30AF\u3092\u77E5\u3063\u3066\u3044\u308B\u7AEF\u672B\u3060\u3051\u304C\u8A18\u9332\u3092\u5171\u6709\u3067\u304D\u307E\u3059\u3002" }),
            /* @__PURE__ */ jsx("div", { mix: recordsActionsStyle, children: [
              /* @__PURE__ */ jsx("button", { type: "button", mix: on("click", copyLink), children: "\u30EA\u30F3\u30AF\u3092\u30B3\u30D4\u30FC" }),
              /* @__PURE__ */ jsx("button", { type: "button", mix: on("click", runSync), children: "\u3044\u307E\u540C\u671F\u3059\u308B" }),
              /* @__PURE__ */ jsx("button", { type: "button", mix: on("click", removeLink), children: "\u540C\u671F\u3092\u89E3\u9664" })
            ] })
          ] }) : /* @__PURE__ */ jsx(Fragment, { children: [
            /* @__PURE__ */ jsx("p", { children: "\u540C\u671F\u3092\u4F7F\u3046\u3068\u3001\u5225\u306E\u7AEF\u672B\u3068\u540C\u3058\u5B66\u7FD2\u8A18\u9332\u3092\u5171\u6709\u3067\u304D\u307E\u3059\u3002" }),
            /* @__PURE__ */ jsx("button", { type: "button", mix: on("click", createLink), children: "\u540C\u671F\u30EA\u30F3\u30AF\u3092\u4F5C\u6210" })
          ] }),
          status.message ? /* @__PURE__ */ jsx("p", { role: "status", mix: recordsStatusStyle, children: status.message }) : null
        ] }),
        /* @__PURE__ */ jsx("section", { mix: recordsSectionStyle, children: [
          /* @__PURE__ */ jsx("h2", { children: [
            "\u7B54\u3048\u3092\u78BA\u8A8D\u3057\u305F\u554F\u984C\uFF08",
            view.progress.length,
            "\uFF09"
          ] }),
          view.progress.length === 0 ? /* @__PURE__ */ jsx("p", { children: "\u307E\u3060\u8A18\u9332\u306F\u3042\u308A\u307E\u305B\u3093\u3002" }) : /* @__PURE__ */ jsx("ul", { children: view.progress.slice(0, 50).map((entry) => /* @__PURE__ */ jsx("li", { children: [
            /* @__PURE__ */ jsx("a", { href: `/records#${entry.questionId}`, children: entry.questionId }),
            /* @__PURE__ */ jsx("span", { children: formatDuration(entry.updatedAt - entry.createdAt) })
          ] }, entry.questionId)) })
        ] }),
        /* @__PURE__ */ jsx("section", { mix: recordsSectionStyle, children: [
          /* @__PURE__ */ jsx("h2", { children: [
            "\u5C0F\u30C6\u30B9\u30C8\u306E\u7D50\u679C\uFF08",
            view.challenges.length,
            "\uFF09"
          ] }),
          view.challenges.length === 0 ? /* @__PURE__ */ jsx("p", { children: "\u307E\u3060\u7D50\u679C\u306F\u3042\u308A\u307E\u305B\u3093\u3002" }) : /* @__PURE__ */ jsx("ul", { children: view.challenges.slice(0, 20).map((snapshot) => {
            const payload = snapshotToPayload(snapshot);
            if (!payload) {
              return null;
            }
            const summary = summarizeChallenge(payload);
            return /* @__PURE__ */ jsx("li", { children: [
              /* @__PURE__ */ jsx("span", { children: payload.examId }),
              /* @__PURE__ */ jsx("span", { children: formatAccuracy(summary.accuracy) }),
              /* @__PURE__ */ jsx("span", { children: [
                summary.correctCount,
                " / ",
                summary.correctCount + summary.incorrectCount
              ] })
            ] }, payload.challengeId);
          }) })
        ] })
      ] });
    };
  }
);
function snapshotToPayload(snapshot) {
  if (snapshot.status !== "completed" || snapshot.updatedAt === null) {
    return null;
  }
  return {
    challengeId: snapshot.challengeId,
    examId: snapshot.examId,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
    answers: snapshot.questionIds.flatMap((questionId) => {
      const judgment = snapshot.judgments[questionId];
      if (!judgment) {
        return [];
      }
      return [
        {
          questionId,
          elapsedMs: snapshot.questionElapsedMs[questionId] ?? 0,
          judgment,
          createdAt: snapshot.answerCreatedAt[questionId] ?? snapshot.createdAt,
          updatedAt: snapshot.updatedAt
        }
      ];
    })
  };
}

// app/features/answer/ui/continue-learning.tsx
var sectionStyle2 = css({
  marginTop: "2rem",
  padding: "1rem 1.25rem",
  background: "var(--color-bg-card)",
  border: "1px solid var(--color-border)",
  borderRadius: "0.75rem"
});
var listStyle3 = css({
  listStyle: "none",
  margin: "0 0 0.5rem",
  padding: 0,
  display: "grid",
  gap: "0.25rem"
});
var linkStyle = css({
  color: "var(--color-primary)",
  textDecoration: "none",
  "&:hover": { textDecoration: "underline" }
});
var ContinueLearning = clientEntry(
  "/assets/client.js#ContinueLearning",
  function ContinueLearningEntry(handle) {
    let expanded = false;
    const recent = () => {
      const entries = Object.values(readProgress()).toSorted(
        (left, right) => right.updatedAt - left.updatedAt
      );
      const byQuestion = new Map(entries.map((entry) => [entry.questionId, entry]));
      const items = [];
      for (const group of handle.props.groups) {
        for (const questionId of group.questionIds) {
          if (byQuestion.has(questionId)) {
            items.push({
              questionId,
              href: `${group.hrefPrefix}${questionId}`,
              unitName: group.unitName,
              year: group.year
            });
          }
        }
      }
      return items;
    };
    return () => {
      const items = recent();
      if (items.length === 0) {
        return null;
      }
      const visible = expanded ? items : items.slice(0, 5);
      return /* @__PURE__ */ jsx("section", { mix: sectionStyle2, "aria-labelledby": "continue-learning-title", children: [
        /* @__PURE__ */ jsx("h2", { id: "continue-learning-title", children: "\u524D\u56DE\u306E\u7D9A\u304D" }),
        /* @__PURE__ */ jsx("ul", { mix: listStyle3, children: visible.map((item) => /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsx("a", { mix: linkStyle, href: item.href, children: [
          item.unitName,
          " ",
          item.year,
          "\u5E74\u5EA6 \u2014 ",
          item.questionId
        ] }) }, item.questionId)) }),
        items.length > visible.length || expanded ? /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            mix: [
              quietButtonStyle,
              on("click", () => {
                expanded = !expanded;
                void handle.update();
              })
            ],
            children: expanded ? "\u9589\u3058\u308B" : "\u3082\u3063\u3068\u898B\u308B"
          }
        ) : null
      ] });
    };
  }
);

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
