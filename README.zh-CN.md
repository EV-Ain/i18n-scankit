# i18n-scankit

[English](./README.md) · **简体中文**

> 零构建的命令行工具：扫描源码中的 `t()` / `k()` 调用，同步 locale JSON 文件，
> 机器翻译缺失的 key，并揪出那些**无法翻译的动态 key** —— 配色清爽、`路径:行号`
> 可点击跳转。

[![CI](https://github.com/your-name/i18n-scankit/actions/workflows/ci.yml/badge.svg)](https://github.com/your-name/i18n-scankit/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/i18n-scankit.svg)](https://www.npmjs.com/package/i18n-scankit)
[![license](https://img.shields.io/npm/l/i18n-scankit.svg)](./LICENSE)

`i18n-scankit` 是一个零依赖的小工具，专为
[i18next](https://www.i18next.com/) 这类**用原文当 key**（`t("你好")`）的方案设计。
它让 locale JSON 与代码保持同步、自动补齐机器翻译，更重要的是——把静态分析永远
看不到的那些 key 告诉你。

## 适用于哪些项目

- ✅ **任何「原文当 key」的 i18n 方案** —— i18next、react-i18next、vue-i18n，
  或自定义的 `t()`，只要调用形如 `t("某段文案")`。
- ✅ **React、Vue、Svelte、Solid 或纯 JS/TS** 项目（`.ts/.tsx/.js/.jsx`）。
- ✅ locale 存为**扁平的 `{ "key": "value" }` JSON**，每种语言一个文件。
- ⚠️ **可配置，非写死** —— 扫描的函数名（`t`、`k`）、目录、语言都在
  `i18n.config.js` 里设置。
- ❌ **不适用于带命名空间 key 的方案**，如 `t("home.title")` 配独立文案文件 ——
  本工具假定 key 本身就是原文。

---

## 为什么需要它

「原文当 key」的方案普遍会在**动态 key** 上悄悄出问题：

```jsx
const TABS = [{ id: "open", label: "当前委托" }];
//  ...
<span>{t(tab.label)}</span>   // ← 扫描器看不到 "当前委托"
```

正则扫描器只看得到 `t(tab.label)`，看不到那个字符串，于是这个 key 永远不会被加进
locale 文件、永远不会被翻译，非源语言界面就只能回退显示原文。`i18n-scankit`
**能检测到这些动态 key**，并给你两种干净的修法（`k()` 标记 或 登记表文件）。

## 特性

- **`scan`** —— 从 `t()` / `k()` 调用提取 key 并同步进每个 locale 文件（按 key
  排序，diff 稳定）。
- **动态 key 检测** —— 报告每一处扫描器无法翻译的 `t(变量)`，按文件分组，
  `路径:行号` 可点击。
- **`translate`** —— 用 **DeepL**（质量最佳）或免费的 **MyMemory** 机器翻译空值。
  内置增量保存、`{{变量}}` 保护、配额/错误拦截。
- **`check`** —— 按语言输出翻译进度百分比；有缺失时**退出码为 `1`**，可用于 CI 卡口。
- **`prune`** —— 删除源码中已不存在的废弃 key。
- **零构建、零依赖** —— 纯 ESM，Node 18+ 即可运行；`k()` 标记自带 TypeScript 类型。
- **输出友好** —— 彩色在管道 / CI / `NO_COLOR` 下自动降级；在 VS Code 终端里用
  OSC 8 超链接精确跳到对应行。

---

## 安装

```bash
npm install --save-dev i18n-scankit
# 或
yarn add -D i18n-scankit
# 或
pnpm add -D i18n-scankit
```

> 不想走 npm？直接从 Git 安装：
> `yarn add -D github:your-name/i18n-scankit`

在 `package.json` 里加 scripts：

```jsonc
{
  "scripts": {
    "i18n:scan": "i18n-scankit scan",
    "i18n:translate": "i18n-scankit translate",
    "i18n:check": "i18n-scankit check",
    "i18n:prune": "i18n-scankit prune"
  }
}
```

---

## 配置

在项目根目录创建 `i18n.config.js`（见
[`examples/i18n.config.js`](./examples/i18n.config.js)）：

```js
export default {
  langs: [
    { code: "zh-CN", source: true },     // 源语言（值 == key）
    { code: "en", deepl: "EN-US" },      // 目标语言
    { code: "ja", deepl: "JA" }
  ],
  localesDir: "src/i18n/locales",        // <code>.json 文件所在目录
  srcDir: "src",                         // 扫描目录
  extensions: [".tsx", ".ts", ".jsx", ".js"],
  markers: ["t", "k"],                   // 第一个字符串实参为 key 的函数名
  registryPattern: "dynamic-keys",       // 手动登记表文件名标识
  requestDelay: 300                      // 翻译请求间隔（毫秒）
};
```

`i18n.config.mjs`、`i18n.config.json`，以及 `package.json` 里的 `"i18n"` 字段
都受支持。所有字段都可选。

| 字段              | 默认值                                | 说明 |
| ----------------- | ------------------------------------- | ---- |
| `langs`           | `[{ code: "en", source: true }]`      | 语言列表。其中且仅一个为源语言，其余为目标语言。`deepl` / `mymemory` 可覆盖各引擎使用的语言代码。 |
| `localesDir`      | `"locales"`                           | `<code>.json` 文件所在目录。 |
| `srcDir`          | `"src"`                               | 扫描 key 的目录。 |
| `extensions`      | `[".tsx",".ts",".jsx",".js"]`         | 要扫描的扩展名。 |
| `markers`         | `["t","k"]`                           | 携带 key 的函数名。**第一个**同时作为动态 key 检测的运行时翻译函数。 |
| `registryPattern` | `"dynamic-keys"`                      | 文件名（basename）含此串的文件，其内**所有**字符串字面量都会被收集为 key。 |
| `requestDelay`    | `300`                                 | 翻译请求之间的间隔（毫秒）。 |

---

## 使用

```bash
i18n-scankit scan          # 提取 key → 同步 locale → 报告动态 key
i18n-scankit translate     # 补齐空值（所有目标语言）
i18n-scankit translate en  # 只翻英文
i18n-scankit check         # 进度报告（不完整则退出码 1）
i18n-scankit prune         # 删除源码中已不存在的 key
```

新增 UI 文案后的典型流程：

```bash
yarn i18n:scan        # 收集新的 t("...") key
yarn i18n:translate   # 机器翻译空白项
yarn i18n:check       # 确认无遗漏
```

### DeepL（推荐）

默认用免费的 MyMemory，无需 key，但有限速、质量一般。设置 `DEEPL_KEY` 即可改用
DeepL：

```bash
DEEPL_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx yarn i18n:translate
```

---

## 处理动态 key

当 `scan` 报告动态 key 时，有两种方式让它们可被翻译。

### 方案 A —— `k()` 标记（推荐）

导入这个 no-op 标记函数，在**声明 label 的地方**包一层。渲染处完全不变。

```tsx
import { k } from "i18n-scankit";

const TABS = [
  { id: "open", label: k("当前委托") },     // ← 现在扫描器能看到它
  { id: "history", label: k("历史委托") }
];

// 渲染处不变：
<span>{t(tab.label)}</span>
```

`k()` 运行时原样返回入参，并自带 TypeScript 类型。

### 方案 B —— 手动登记表

对于无法在声明处包裹的 key（例如来自接口返回），在一个文件名匹配
`registryPattern`（默认 `dynamic-keys`）的文件里，把它们平铺为普通字符串：

```ts
// src/i18n/dynamic-keys.ts —— 仅供扫描，运行时不引用
export const DYNAMIC_KEYS = ["待成交", "已成交", "已撤销"];
```

> ⚠️ 不要在 `markers` / 登记表文件的**注释**里写带引号的中文 —— 带引号的字符串
> 即使在注释里也会被原样收集。

### 展开报告

```bash
I18N_DYNAMIC=full i18n-scankit scan   # 每一处单独成行、逐个可点击
```

---

## CI 卡口

只要有目标语言的 key 为空，`check` 就以退出码 `1` 结束：

```yaml
# .github/workflows/i18n.yml
- run: npx i18n-scankit check
```

---

## 终端输出

- **彩色**仅在 TTY 下启用，`NO_COLOR=1` 可关闭 —— 管道和 CI 日志保持干净。
- **可点击引用**：在 **VS Code** 集成终端里，动态 key 渲染为简短的
  `文件名:行号` OSC 8 超链接，点击直接跳到对应行。其它终端显示完整
  `路径:行号`，由它们自带的 linkifier 识别。

---

## 注意与限制

- 扫描器用正则匹配文本，**不执行也不类型检查**你的代码，所以扫描 `.ts`/`.tsx`
  安全又快速。
- 它无法解析运行时才确定的值 —— 这正是动态 key 检测以及 `k()` / 登记表这两个
  逃生口存在的原因。
- 机器翻译只是起点，不能替代人工校对，尤其是短的 UI / 业务术语。

---

## 参与贡献

欢迎提 Issue 和 PR。运行测试：

```bash
node --test
```

## 许可证

[MIT](./LICENSE)
