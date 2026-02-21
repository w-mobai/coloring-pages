# AI 涂色页生成器 - 需求文档

## 1. 产品概述

### 1.1 产品目标
为 3-10 岁儿童的家长和教师提供快速生成可打印黑白涂色页的 AI 工具。

### 1.2 目标用户
- 家长：为孩子准备涂色活动
- 幼儿园/小学教师：制作教学材料
- 儿童教育机构：批量生成涂色素材

### 1.3 核心价值
- 快速生成：30 秒内生成高质量涂色页
- 年龄适配：根据儿童年龄自动调整线条粗细和复杂度
- 灵活比例：支持竖版、横版、正方形三种比例，适合不同打印需求

---

## 2. 功能需求

### 2.1 用户输入

#### 2.1.1 主题输入框
- **字段类型**：单行文本输入框
- **必填**：是
- **字符限制**：最多 30 个字符
- **占位符文本**："例如：可爱小恐龙、小猫在花园、消防车"
- **实时字符计数**：显示 "X / 30"
- **验证规则**：
  - 不能为空
  - 不能超过 30 个字符

**示例输入**：
- "可爱小恐龙"
- "小猫在花园里玩耍"
- "红色消防车"
- "公主城堡"
- "太空火箭"

#### 2.1.2 年龄选择器
- **字段类型**：单选按钮组（Radio Group）
- **必填**：是
- **默认值**：幼儿（3-5岁）

**选项**：

| 选项值 | 显示文本 | 说明 | 生成特点 |
|--------|---------|------|---------|
| `toddler` | 👶 幼儿（3-5岁） | 粗线条、少细节 | 非常粗的黑色轮廓线、最少细节、大型简单形状、大量留白 |
| `child` | 🧒 儿童（6-10岁） | 中等细节 | 中等粗细黑色轮廓线、适度细节、清晰定义的区域 |

#### 2.1.3 比例选择器（新增）
- **字段类型**：单选按钮组（Radio Group）或图标按钮组
- **必填**：是
- **默认值**：竖版（portrait）

**选项**：

| 选项值 | 显示图标 | 显示文本 | 说明 |
|--------|---------|---------|------|
| `portrait` | 📱 (竖向矩形图标) | 竖版 | 适合 A4 纸竖向打印 |
| `landscape` | 🖼️ (横向矩形图标) | 横版 | 适合 A4 纸横向打印 |
| `square` | ⬜ (正方形图标) | 正方形（实验性） | 正方形构图，需验证 kie.ai 支持情况 |

**UI 设计**：
- 使用图标按钮组，每个按钮显示对应比例的图标
- 选中状态：高亮边框或背景色
- 图标下方显示文字标签
- 布局：水平排列三个选项

#### 2.1.4 生成按钮
- **按钮文案**：
  - 已登录 + 默认状态："生成涂色页"
  - 已登录 + 生成中："生成中..."
  - 未登录："立即登录"
- **图标**：
  - 默认：✨ Sparkles
  - 生成中：⏳ Loader2（旋转动画）
  - 未登录：👤 User
- **禁用条件**：
  - 已登录 + 正在生成中
  - 已登录 + 主题输入为空
- **点击行为**：
  - 未登录：打开登录/注册弹窗（无论主题是否为空）
  - 已登录：
    - 验证输入（主题不能为空）
    - 检查用户积分（积分不足时显示错误提示）
    - 调用 AI 生成 API
    - 显示进度条
    - 轮询任务状态

---

### 2.2 生成逻辑

#### 2.2.1 Prompt 构建规则

根据用户输入的主题和选择的年龄组，自动构建完整的 AI prompt：

```
{用户主题}, {年龄组样式描述}
```

**注意**：比例（aspect_ratio）不进入 prompt，仅通过 API 参数控制。

**年龄组样式描述**：

**幼儿模式（toddler）**：
```
simple coloring page for toddlers, very thick bold black outlines, minimal details, large simple shapes, lots of white space, pure white background, black and white line art only, no shading, no colors, no background elements, clean lines, with a simple rectangular border frame around the page, suitable for 3-5 year olds
```

**儿童模式（child）**：
```
coloring page for children, medium thickness black outlines, moderate details, clear defined areas, pure white background, black and white line art only, no shading, no colors, no background elements, clean lines, with a simple rectangular border frame around the page, suitable for 6-10 year olds
```

**完整示例**：
- 输入主题："可爱小恐龙"
- 选择年龄：幼儿
- 选择比例：竖版（不影响 prompt）
- 最终 Prompt：
  ```
  可爱小恐龙, simple coloring page for toddlers, very thick bold black outlines, minimal details, large simple shapes, lots of white space, pure white background, black and white line art only, no shading, no colors, no background elements, clean lines, with a simple rectangular border frame around the page, suitable for 3-5 year olds
  ```

#### 2.2.2 AI API 调用

**接口**：`POST /api/ai/generate`

**请求参数**：
```json
{
  "mediaType": "IMAGE",
  "scene": "text-to-image",
  "provider": "kie",
  "model": "nano-banana-pro",
  "prompt": "{构建的完整 prompt}",
  "options": {
    "aspect_ratio": "portrait",
    "resolution": "high"
  }
}
```

**aspect_ratio 参数映射**：
- 竖版（portrait）→ `"aspect_ratio": "portrait"`
- 横版（landscape）→ `"aspect_ratio": "landscape"`
- 正方形（square）→ `"aspect_ratio": "square"`

**说明**：
- `aspect_ratio` - 根据用户选择的比例设置，直接传递给 kie.ai
- `resolution: "high"` - 高分辨率输出
- kie.ai 适配层会直接传递 aspect_ratio 值（`kie.ts` line 161）
- 不使用 `width`/`height` 参数，因为 kie 适配层不会处理这些字段
- 实际输出分辨率由 kie.ai 服务决定，通常为高质量可打印尺寸
- 后端会自动扣除 2 积分（text-to-image 场景固定消耗）

**风险提示与降级策略**：
- kie.ai 文档未明确列出所有支持的 aspect_ratio 值
- `square` 为推测值，需要在测试阶段验证是否支持
- **降级策略（单一路径，按顺序执行）**：
  1. **首次尝试**：使用 `"aspect_ratio": "square"`
  2. **第一次降级**：如果检测到 aspect_ratio 相关错误，尝试 `"aspect_ratio": "1:1"` 格式
  3. **最终降级**：如果 `1:1` 也不支持，回退到 `"aspect_ratio": "portrait"` 并在前端显示 Toast 提示："正方形比例暂不支持，已使用竖版比例生成"
- **触发条件（按优先级判断，覆盖同步和异步失败）**：
  1. **同步失败**：`/api/ai/generate` 接口立即返回 aspect_ratio 相关错误
  2. **异步失败**：`/api/ai/query` 轮询时，从 `taskInfo` 中提取错误信息
     - `taskInfo` 通常是 JSON 字符串，需要先安全解析：`JSON.parse(taskInfo)`
     - 解析成功后，检查 `errorCode` 或 `errorMessage` 字段是否包含 aspect_ratio 相关错误
     - 解析失败或字段缺失时，直接走文本匹配兜底（检查原始响应中的错误信息）
  3. 优先：检查响应中的结构化错误字段（如 `errorCode`、`error.type`、解析后的 `taskInfo.errorCode` 等）
  4. 兜底：如果无结构化字段或字段缺失/解析失败，则匹配错误消息文本（规范化后做子串匹配，包含以下关键词不区分大小写："aspect_ratio"、"aspect ratio"、"invalid ratio"、"unsupported ratio"）
- **实现建议**：
  - 在第一阶段实现时先使用 `square` 值，测试失败后再按顺序降级
  - 优先使用结构化错误判断，提高鲁棒性
  - 文本匹配作为兜底方案，支持多种错误格式
  - 在生成接口和轮询接口都要检查 aspect_ratio 错误
  - **重要**：轮询返回的 `taskInfo` 可能为空或字段缺失，实现时必须做防御性检查，确保字段缺失时仍能走文本匹配兜底
- **注意**：不隐藏正方形选项，保持 UI 一致性，通过降级和提示处理兼容性问题

**响应**：
```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": "task-uuid",
    "status": "pending",
    "provider": "kie",
    "model": "nano-banana-pro",
    "prompt": "...",
    "taskInfo": null,
    "taskResult": null,
    "costCredits": 2
  }
}
```

#### 2.2.3 任务轮询

**接口**：`POST /api/ai/query`

**轮询间隔**：5 秒
**超时时间**：180 秒（3 分钟）

**请求参数**：
```json
{
  "taskId": "task-uuid"
}
```

**任务状态**：
- `pending`：等待中
- `processing`：生成中
- `success`：成功
- `failed`：失败

---

### 2.3 积分系统

#### 2.3.1 已登录用户
- **消耗积分**：每次生成消耗 2 积分（与现有 text-to-image 一致）
- **积分检查**：生成前检查用户剩余积分
- **积分不足**：显示错误提示 "积分不足，请充值后继续"
- **积分扣除时机**：调用 API 时在数据库事务中扣除（由后端 `createAITask` 处理）
- **积分回滚机制**：
  - 当任务状态被更新为 `failed` 时，后端自动退回积分
  - 回滚由 `updateAITaskById` 函数处理（`ai_task.ts` line 60）
  - 触发路径：前端轮询 `/api/ai/query` 时，后端查询 kie.ai 状态并更新任务
  - 注意：任务超时不会自动回滚积分（任务可能仍在处理中）
- **积分刷新**：生成完成后刷新用户积分显示

#### 2.3.2 新用户积分赠送（依赖后台配置）

**配置项**（在系统后台 Settings 中配置）：
- `initial_credits_enabled` - 是否启用新用户积分赠送（默认：false）
- `initial_credits_amount` - 赠送积分数量（默认：无，需要配置）
- `initial_credits_valid_days` - 积分有效期天数（默认：无，需要配置，0 表示永久有效）
- `initial_credits_description` - 积分描述（默认："initial credits"）

**实现逻辑**：
- 新用户注册时，后端 `grantCreditsForNewUser` 函数根据配置自动发放积分
- 代码位置：`credit.ts` line 324-350
- 本需求不涉及修改注册赠送逻辑，使用现有实现

**推荐配置**（用于涂色页试用）：
- `initial_credits_enabled`: true
- `initial_credits_amount`: 10（可生成 5 次涂色页）
- `initial_credits_valid_days`: 30（30 天有效期）
- `initial_credits_description`: "新用户赠送积分"

**未登录用户引导**：
- 未登录用户无法使用生成功能
- 显示引导按钮："立即登录"
- 按钮下方显示提示文案："注册即可获得新手积分"（通用文案，不承诺具体次数）
- 点击按钮打开登录/注册弹窗

**说明**：
- 通过现有的积分赠送配置实现试用
- 管理员可在后台灵活调整赠送数量和有效期
- 前端文案不硬编码具体次数，避免与配置不一致

#### 2.3.3 积分显示

**已登录用户**：
```
消耗 2 积分 | 剩余 X 积分
```

**未登录用户**：
```
显示引导按钮："立即登录"
按钮下方提示："注册即可获得新手积分"
```

---

### 2.4 生成进度

#### 2.4.1 进度条
- **组件**：Progress 组件
- **初始值**：15%
- **更新规则**：
  - 调用 API 成功：25%
  - 任务状态 `pending`：保持 25%（不回退）
  - 任务状态 `processing`：40% - 85%（递增）
  - 任务状态 `success`：100%

#### 2.4.2 状态提示文本

| 任务状态 | 提示文本 |
|---------|---------|
| `pending` | "正在准备生成..." |
| `processing` | "正在绘制涂色页..." |
| `success` | "涂色页生成成功！" |
| `failed` | "生成失败，请重试" |

---

### 2.5 结果展示

#### 2.5.1 图片展示
- **显示位置**：右侧卡片
- **图片样式**：
  - 宽度：100%
  - 圆角：rounded-lg
  - 边框：border
- **Alt 文本**：用户输入的主题

#### 2.5.2 下载功能
- **按钮文案**："下载涂色页"
- **图标**：📥 Download
- **下载方式**：
  1. 通过代理接口获取图片：`/api/proxy/file?url={imageUrl}`
  2. 转换为 Blob
  3. 创建临时下载链接
  4. 触发浏览器下载
  5. 清理临时链接
- **文件名格式**：`coloring-page-{主题前10字符}-{时间戳}.jpg`
- **下载状态**：
  - 下载中：显示加载图标
  - 成功：显示成功提示
  - 失败：显示错误提示

#### 2.5.3 空状态
当没有生成结果时，显示：
- 图标：🎨 ImageIcon
- 文本：
  - 未开始生成："输入主题后点击生成"
  - 生成中："正在生成..."

---

### 2.6 错误处理

#### 2.6.1 输入验证错误

| 错误场景 | 错误提示 | 触发时机 |
|---------|---------|---------|
| 主题为空 | "请输入涂色页主题" | 已登录用户点击生成按钮时（按钮禁用时不会触发，此为防御性校验） |
| 主题超过 30 字 | "主题不能超过 30 个字符" | 输入框实时验证（maxLength 限制） |

**测试说明**：
- "主题为空"错误：正常情况下按钮已禁用，此错误为防御性分支
- 前端防御：按钮禁用 + 客户端校验
- 后端防御：当前后端在有 options 时不会拦截空 prompt（`route.ts` line 19），会传递到 provider 层报错
- 实际错误信息：provider 层返回 "prompt is required"（`kie.ts` line 143）
- **前端错误映射规则（精确匹配，避免误判）**：
  - **规范化策略**：先对错误消息进行规范化处理（trim 去首尾空格 + toLowerCase 转小写 + 去除尾部标点符号 `.!?`），再进行匹配
  - 匹配模式（规范化后）：`"prompt is required"`、`"prompt required"`、`"missing prompt"`、`"empty prompt"` → 映射为 "请输入涂色页主题"
  - 不匹配：`"prompt 违规"`、`"prompt 不安全"`、`"invalid prompt content"`、`"unsafe prompt"` 等内容问题 → 映射为 "生成失败，请重试"
  - 其他错误 → 映射为 "生成失败，请重试"
  - **单元测试建议**：应覆盖更多变体文案，避免漏判：
    - 标准格式：`"prompt is required"`、`"Prompt is required"`、`"PROMPT IS REQUIRED"`
    - 变体格式：`"prompt required"`、`"Prompt Required"`、`"missing prompt"`、`"Missing Prompt"`、`"empty prompt"`、`"Empty Prompt"`
    - 带标点：`"prompt is required."`、`"prompt is required!"`、`"  prompt is required  "`（带空格）
    - 误判测试：`"prompt content is invalid"`、`"prompt 违规"`、`"unsafe prompt"` 应映射为 "生成失败，请重试"

#### 2.6.2 权限错误

| 错误场景 | 错误提示 | 触发时机 |
|---------|---------|---------|
| 未登录 | "请先登录" | 点击生成按钮时（不应该发生，因为未登录时按钮是"立即登录"） |
| 已登录用户积分不足 | "积分不足，请充值后继续" | 点击生成按钮时检查积分 |

#### 2.6.3 API 错误

| 错误场景 | 错误提示 | 积分处理 |
|---------|---------|---------|
| 网络请求失败 | "网络错误，请检查网络连接" | 不扣积分（未调用 API） |
| API 返回错误 | 先通过 `mapErrorMessage` 映射，未命中则显示 "生成失败，请重试" | 不扣积分（API 调用失败） |
| 任务超时 | "生成超时，请重试" | 已扣积分不退回（任务可能仍在处理） |
| 生成失败 | "生成失败，请重试" | 在任务状态更新为 failed 时自动退回 |

**错误处理优先级**：
1. 首先通过 `mapErrorMessage` 函数映射错误（精确匹配 "prompt is required"、"prompt required"、"missing prompt"、"empty prompt" 等模式 → "请输入涂色页主题"）
2. 如果未命中映射规则，显示通用提示 "生成失败，请重试"
3. 不直接显示后端原始错误信息（如 "prompt is required"），确保用户友好
4. 避免误判：不匹配 "prompt 违规"、"invalid prompt content" 等内容问题

**说明**：
- 积分扣除在 `createAITask` 时完成（数据库事务）
- 任务状态变为 `failed` 时，后端 `updateAITaskById` 会自动回滚积分
- 状态更新触发路径：前端轮询 `/api/ai/query` → 后端查询 kie.ai → 更新任务状态
- 超时情况下任务可能仍在处理，不退回积分
- 注意：当前系统不依赖 webhook 回调，仅通过轮询更新状态

---

## 3. 技术需求

### 3.1 前端组件

#### 3.1.1 新建文件
- `src/shared/blocks/generator/coloring-page.tsx` - 核心组件
- `src/themes/default/blocks/coloring-page-generator.tsx` - 主题包装器

#### 3.1.2 复用现有组件
- `Button` - 按钮
- `Card`, `CardHeader`, `CardTitle`, `CardContent` - 卡片
- `Input` - 输入框
- `Label` - 标签
- `RadioGroup`, `RadioGroupItem` - 单选按钮组
- `Progress` - 进度条
- `LazyImage` - 图片懒加载

#### 3.1.3 复用现有逻辑
从 `ImageGenerator` 组件复用：
- 用户状态管理（`useAppContext`）
- 积分检查逻辑
- API 调用逻辑
- 任务轮询逻辑
- 图片下载逻辑
- 错误处理逻辑
- Toast 提示

**注意**：不复用免费试用逻辑，因为涂色页生成要求用户必须登录。

### 3.2 状态管理

```typescript
// 组件状态
const [theme, setTheme] = useState<string>('');
const [ageGroup, setAgeGroup] = useState<'toddler' | 'child'>('toddler');
const [aspectRatio, setAspectRatio] = useState<'portrait' | 'landscape' | 'square'>('portrait');
const [isGenerating, setIsGenerating] = useState<boolean>(false);
const [progress, setProgress] = useState<number>(0);
const [taskId, setTaskId] = useState<string | null>(null);
const [generationStartTime, setGenerationStartTime] = useState<number | null>(null);
const [taskStatus, setTaskStatus] = useState<AITaskStatus | null>(null);
const [generatedImage, setGeneratedImage] = useState<GeneratedImage | null>(null);
const [downloadingImageId, setDownloadingImageId] = useState<string | null>(null);
const [isMounted, setIsMounted] = useState<boolean>(false);

// 从 Context 获取
const { user, isCheckSign, setIsShowSignModal, fetchUserCredits } = useAppContext();
```

**注意**：不需要 `freeTrialsRemaining` 状态，因为必须登录才能使用。

### 3.3 核心函数

```typescript
// Prompt 构建
function buildColoringPrompt(theme: string, ageGroup: 'toddler' | 'child'): string

// 生成处理
async function handleGenerate(): Promise<void>

// 任务轮询
async function pollTaskStatus(taskId: string): Promise<boolean>

// 下载图片
async function handleDownloadImage(image: GeneratedImage): Promise<void>

// 重置状态
function resetTaskState(): void

// 图片尺寸验证（用于验收测试）
function validateImageDimensions(imageUrl: string): Promise<{ width: number; height: number; valid: boolean }>

// 错误消息映射（将 provider 原始错误映射为用户友好提示）
// 优先级：先匹配映射规则，未命中则返回通用提示
// 规范化策略：trim() + toLowerCase() + 去除尾部标点 (.!?) 后再匹配
// 规则：精确匹配 "prompt is required"、"prompt required"、"missing prompt"、"empty prompt"（规范化后）→ "请输入涂色页主题"
// 其他（包括 prompt 内容违规等）→ "生成失败，请重试"
// 避免误判：不使用宽泛的 "包含 prompt" 匹配，防止将内容问题误判为空主题
// 单元测试：应覆盖标准格式、变体格式、带标点、带空格、误判场景等多种文案
function mapErrorMessage(error: string): string

// aspect_ratio 错误判断（用于降级策略）
// 触发时机：生成接口立即报错 或 轮询阶段任务失败
// 异步失败处理：taskInfo 通常是 JSON 字符串，需先安全解析 JSON.parse(taskInfo)
// 优先级：优先检查结构化错误字段（errorCode/error.type/解析后的taskInfo.errorCode），兜底使用文本匹配
// 文本匹配：规范化后做子串匹配，包含以下关键词不区分大小写："aspect_ratio"、"aspect ratio"、"invalid ratio"、"unsupported ratio"
// 防御性检查：JSON 解析失败或字段缺失时，直接走文本匹配兜底
function isAspectRatioError(error: any): boolean
```

---

## 4. 国际化

### 4.1 翻译 Key

在 `messages/zh.json` 和 `messages/en.json` 中添加：

```json
{
  "ai": {
    "coloring": {
      "title": "AI 涂色页生成器",
      "theme_label": "涂色页主题",
      "theme_placeholder": "例如：可爱小恐龙、小猫在花园、消防车",
      "age_label": "适合年龄",
      "age_toddler": "幼儿（3-5岁）",
      "age_toddler_desc": "粗线条、少细节",
      "age_child": "儿童（6-10岁）",
      "age_child_desc": "中等细节",
      "aspect_ratio_label": "图片比例",
      "aspect_ratio_portrait": "竖版",
      "aspect_ratio_landscape": "横版",
      "aspect_ratio_square": "正方形",
      "generate": "生成涂色页",
      "generating": "生成中...",
      "download": "下载涂色页",
      "result_title": "生成结果",
      "empty_hint": "输入主题后点击生成",
      "generating_hint": "正在生成...",
      "credits_cost": "消耗 {credits} 积分",
      "credits_remaining": "剩余 {credits} 积分",
      "loading": "加载中...",
      "checking_account": "检查账户中...",
      "sign_in_button": "立即登录",
      "sign_in_hint": "注册即可获得新手积分",
      "progress": "生成进度",
      "status_pending": "正在准备生成...",
      "status_processing": "正在绘制涂色页...",
      "status_success": "涂色页生成成功！",
      "status_failed": "生成失败，请重试",
      "error_empty_theme": "请输入涂色页主题",
      "error_theme_too_long": "主题不能超过 30 个字符",
      "error_insufficient_credits": "积分不足，请充值后继续",
      "error_not_logged_in": "请先登录",
      "error_generation_failed": "生成失败，请重试",
      "error_timeout": "生成超时，请重试",
      "error_network": "网络错误，请检查网络连接",
      "error_aspect_ratio_fallback": "正方形比例暂不支持，已使用竖版比例生成",
      "success_generated": "涂色页生成成功！",
      "success_downloaded": "涂色页已下载",
      "error_download_failed": "下载失败，请重试"
    }
  }
}
```

### 4.2 英文翻译

```json
{
  "ai": {
    "coloring": {
      "title": "AI Coloring Page Generator",
      "theme_label": "Coloring Page Theme",
      "theme_placeholder": "e.g., Cute dinosaur, Cat in garden, Fire truck",
      "age_label": "Age Group",
      "age_toddler": "Toddler (3-5 years)",
      "age_toddler_desc": "Thick lines, minimal details",
      "age_child": "Child (6-10 years)",
      "age_child_desc": "Medium details",
      "aspect_ratio_label": "Aspect Ratio",
      "aspect_ratio_portrait": "Portrait",
      "aspect_ratio_landscape": "Landscape",
      "aspect_ratio_square": "Square",
      "generate": "Generate Coloring Page",
      "generating": "Generating...",
      "download": "Download Coloring Page",
      "result_title": "Generated Result",
      "empty_hint": "Enter a theme and click generate",
      "generating_hint": "Generating...",
      "credits_cost": "Costs {credits} credits",
      "credits_remaining": "{credits} credits remaining",
      "loading": "Loading...",
      "checking_account": "Checking account...",
      "sign_in_button": "Sign In",
      "sign_in_hint": "Get starter credits by signing up",
      "progress": "Generation Progress",
      "status_pending": "Preparing to generate...",
      "status_processing": "Drawing coloring page...",
      "status_success": "Coloring page generated successfully!",
      "status_failed": "Generation failed, please retry",
      "error_empty_theme": "Please enter a theme",
      "error_theme_too_long": "Theme cannot exceed 30 characters",
      "error_insufficient_credits": "Insufficient credits, please top up",
      "error_not_logged_in": "Please sign in first",
      "error_generation_failed": "Generation failed, please retry",
      "error_timeout": "Generation timeout, please retry",
      "error_network": "Network error, please check your connection",
      "error_aspect_ratio_fallback": "Square aspect ratio not supported, using portrait instead",
      "success_generated": "Coloring page generated successfully!",
      "success_downloaded": "Coloring page downloaded",
      "error_download_failed": "Download failed, please retry"
    }
  }
}
```

---

## 5. UI 布局

### 5.1 整体布局
- 单列居中布局（参考 AI Image Generator 设计）
- 最大宽度：800px
- 深色背景主题
- 所有内容垂直排列

### 5.2 主输入区域

```
┌────────────────────────────────────────────────────────────┐
│ AI 涂色页生成器                                  [Add Image]│
├────────────────────────────────────────────────────────────┤
│                                                            │
│ 涂色页主题                                                 │
│ ┌────────────────────────────────────────────────────────┐│
│ │ 例如：可爱小恐龙、小猫在花园、消防车                    ││
│ │                                                        ││
│ │                                                        ││
│ └────────────────────────────────────────────────────────┘│
│ 0 / 30                                                     │
│                                                            │
│ ☐ 幼儿（3-5岁）  ☐ 儿童（6-10岁）                         │
│                                                            │
│ 比例: [竖版 ▼]  [清除]  [随机]  [生成 ▼]                  │
│                                                            │
│ 消耗 2 积分 | 剩余 10 积分                                 │
│                                                            │
│ [进度条: 45%]                                              │
│ 正在绘制涂色页...                                          │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### 5.3 布局特点

**顶部标题栏**：
- 左侧：标题 "AI 涂色页生成器"
- 右侧：[Add Image] 按钮（可选功能，未来扩展用）

**主题输入区**：
- 大型多行文本框（Textarea）
- 最小高度：120px
- 占位符文本：灰色显示示例
- 字符计数器：右下角显示 "0 / 30"

**选项区域（水平排列）**：
- 年龄选择：复选框样式（Checkbox 外观，实际为 Radio）
  - ☐ 幼儿（3-5岁）
  - ☐ 儿童（6-10岁）
- 比例选择：下拉菜单（Select）
  - 选项：竖版、横版、正方形

**操作按钮区（水平排列）**：
- 比例选择器：[竖版 ▼] 下拉菜单
- 清除按钮：清空输入和结果
- 随机按钮：随机生成主题（可选功能）
- 生成按钮：主要操作按钮，带下拉菜单（可选高级选项）
  - 默认：✨ 生成
  - 生成中：⏳ 生成中...
  - 未登录：👤 立即登录

**积分信息**：
- 已登录：消耗 2 积分 | 剩余 X 积分
- 未登录：注册即可获得新手积分

**进度指示器**：
- 仅在生成中显示
- 进度条 + 百分比
- 状态文本（正在准备生成... / 正在绘制涂色页...）

### 5.4 结果展示区域

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│                    [生成的涂色页图片]                       │
│                                                            │
│                    [📥 下载涂色页]                         │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**空状态**：
- 图标：🎨 大号图标
- 文本：
  - 未开始："输入主题后点击生成"
  - 生成中："正在生成..."

**有结果状态**：
- 图片：全宽显示，保持原始比例
- 圆角边框
- 下载按钮：居中显示在图片下方

### 5.5 响应式设计

**桌面端（≥1024px）**：
- 容器最大宽度：800px
- 居中对齐
- 所有元素垂直排列

**平板端（768px - 1023px）**：
- 容器宽度：90%
- 按钮可能换行

**移动端（<768px）**：
- 容器宽度：95%
- 选项区域垂直堆叠
- 按钮全宽显示

---

## 6. 数据库（可选）

如果需要保存生成历史，可以复用现有的 `ai_task` 表，无需创建新表。

现有 `ai_task` 表已包含所有必要字段：
- `user_id` - 用户 ID
- `media_type` - 媒体类型（IMAGE）
- `scene` - 场景类型（text-to-image）
- `provider` - AI 提供商（kie）
- `model` - 模型名称（nano-banana-pro）
- `prompt` - 完整 prompt
- `options` - 生成选项（JSON，包含 aspect_ratio/resolution）
- `status` - 任务状态
- `cost_credits` - 消耗积分
- `task_id` - AI 任务 ID
- `task_info` - 任务信息（JSON）
- `task_result` - 任务结果（JSON）
- `credit_id` - 积分消费记录 ID
- `created_at` - 创建时间

**查询涂色页历史**：
```sql
SELECT * FROM ai_task
WHERE user_id = ? 
  AND media_type = 'IMAGE'
  AND scene = 'text-to-image'
  AND provider = 'kie'
ORDER BY created_at DESC;
```

**注意**：如果需要区分涂色页和普通图片生成，可以：
1. 在 `options` 字段中添加 `{ "type": "coloring-page", "aspect_ratio": "portrait", "resolution": "high" }`
2. 或在 `prompt` 中添加特定标识符

---

## 7. 非功能需求

### 7.1 性能要求
- 页面加载时间：< 2 秒
- 生成响应时间：< 30 秒（正常情况）
- 图片下载时间：< 5 秒

### 7.2 兼容性要求
- 浏览器：Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- 设备：桌面端、平板、手机
- 屏幕尺寸：320px - 2560px

### 7.3 可访问性要求
- 键盘导航支持
- 屏幕阅读器支持
- 适当的 ARIA 标签
- 足够的颜色对比度

### 7.4 安全要求
- API 调用需要身份验证（已由后端强制执行）
- 防止 XSS 攻击
- 防止 CSRF 攻击
- 输入内容转义
- 用户只能查询自己的任务（已由后端验证）

---

## 8. 验收标准

### 8.1 功能验收
- [ ] 用户可以输入主题（最多 30 字）
- [ ] 用户可以选择年龄组（幼儿/儿童）
- [ ] 用户可以选择图片比例（竖版/横版，正方形为实验性功能）
- [ ] 未登录用户看到"立即登录"按钮和"注册即可获得新手积分"提示
- [ ] 未登录用户点击按钮打开登录/注册弹窗（无论主题是否为空）
- [ ] 新用户注册后根据后台配置获得积分（需要管理员在后台启用并配置）
- [ ] 已登录用户在主题为空时按钮禁用
- [ ] 已登录用户在生成中时按钮禁用
- [ ] 已登录用户在积分不足时点击按钮显示错误提示（按钮不禁用）
- [ ] 已登录用户点击生成按钮后显示进度条
- [ ] 生成成功后显示涂色页图片
- [ ] 生成的图片最短边 ≥ 1024px（通过前端读取图片自然尺寸验证）
- [ ] 生成的图片比例符合用户选择（竖版/横版必过，正方形若 provider 不支持可降级不计失败）
- [ ] 用户可以下载生成的涂色页
- [ ] 已登录用户消耗 2 积分
- [ ] 生成失败时自动退回积分（依赖任务状态更新）
- [ ] 生成失败时显示错误提示

### 8.2 UI 验收
- [ ] 布局在桌面端和移动端正常显示
- [ ] 所有文本使用国际化翻译
- [ ] 按钮状态正确（禁用/启用/加载中）
- [ ] 进度条动画流畅
- [ ] 图片加载正常
- [ ] 错误提示清晰易懂
- [ ] 比例选择器图标清晰可辨

### 8.3 性能验收
- [ ] 页面加载时间 < 2 秒
- [ ] 生成时间 < 30 秒（正常情况）
- [ ] 下载时间 < 5 秒
- [ ] 无内存泄漏

### 8.4 测试用例

#### 8.4.1 图片尺寸验证测试
```typescript
// 测试代码示例
async function testImageDimensions(imageUrl: string) {
  const img = new Image();
  img.src = imageUrl;
  await img.decode();
  
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  const minDimension = Math.min(width, height);
  
  console.log(`Image dimensions: ${width}x${height}`);
  console.log(`Min dimension: ${minDimension}px`);
  console.log(`Valid: ${minDimension >= 1024}`);
  
  return {
    width,
    height,
    minDimension,
    valid: minDimension >= 1024
  };
}
```

#### 8.4.2 防御性校验测试

**测试目标**：验证多层防御机制（前端禁用 + 客户端校验 + provider 层校验）+ 错误映射精确性

**测试场景 1 - 后端 API 直接测试**：
- **测试方法**：直接调用后端 API `/api/ai/generate`，传递空 prompt 但包含 options（需携带有效登录会话或使用测试账号）
- **预期结果**：
  - 后端将请求传递到 provider 层
  - Provider 返回原始错误："prompt is required"
  - API 响应包含该错误信息
- **断言**：验证后端返回的原始错误消息

**测试场景 2 - 前端错误映射测试**：
- **测试方法**：
  1. 使用 E2E 测试工具（Playwright/Cypress）注入空值绕过前端校验
  2. 或使用浏览器开发工具修改 DOM 移除 `disabled` 属性后点击
- **预期结果**：
  - 前端捕获后端返回的 "prompt is required" 错误
  - 通过 `mapErrorMessage` 映射为："请输入涂色页主题"
  - 在 UI 显示映射后的友好提示
- **断言**：验证 UI 显示的是映射后的中文提示，而非原始英文错误

**鲁棒性测试**（建议覆盖）：
- 测试不同大小写：`"Prompt is required"`、`"PROMPT IS REQUIRED"`
- 测试不同格式：`"missing prompt"`、`"Prompt Required"`、`"empty prompt"`
- **误判测试**：测试 `"prompt content is invalid"`、`"prompt 违规"` 等内容问题，确保映射为 "生成失败，请重试" 而非 "请输入涂色页主题"

**说明**：
- 场景 1 和场景 2 分开测试，避免混淆后端原始错误和前端映射提示
- 当前后端在有 options 时不会显式校验空 prompt（`route.ts` line 19: `if (!prompt && !options)`），会继续传递到 provider 层才报错
- 这是可接受的防御策略，前端需要按照精确的映射规则处理错误
- API 测试需要鉴权：后端 `/api/ai/generate` 要求用户登录（`route.ts` line 36），测试时需携带有效会话或使用测试账号
- 错误映射应精确匹配特定模式，避免将内容违规等问题误判为空主题

#### 8.4.3 比例验证测试
- **选择竖版**：验证生成图片 height > width（必过）
- **选择横版**：验证生成图片 width > height（必过）
- **选择正方形**（条件化断言）：
  - **场景 1 - 未降级**（square 或 1:1 被 provider 支持）：
    - 断言：生成图片 width ≈ height（允许 ±5% 误差）
    - 无降级提示出现
  - **场景 2 - 已降级**（square 和 1:1 都不被支持）：
    - 断言：Toast 提示出现，内容为 i18n key `error_aspect_ratio_fallback`："正方形比例暂不支持，已使用竖版比例生成"
    - 断言：生成图片 height > width（符合 portrait 比例）
  - **降级策略执行顺序**：
    1. 首次尝试：使用 `"aspect_ratio": "square"`
    2. 如果失败（生成接口或轮询接口返回 aspect_ratio 相关错误）：尝试 `"aspect_ratio": "1:1"`
    3. 如果仍失败：回退到 `"aspect_ratio": "portrait"` 并显示 Toast
  - **降级触发检测**：
    - 同步失败：`/api/ai/generate` 立即返回错误
    - 异步失败：`/api/ai/query` 轮询时从 `taskInfo` 提取错误（若 taskInfo 为字符串需先安全 JSON.parse，解析失败走文本兜底），检查 `errorCode` 或 `errorMessage` 是否包含 aspect_ratio 错误
  - **验收标准**：场景 1 或场景 2 任一通过即可

---

## 9. 实施计划

### 9.1 第一阶段：核心功能（优先级：高）
- [ ] 创建 `ColoringPageGenerator` 组件
- [ ] 实现主题输入、年龄选择和比例选择
- [ ] 实现 Prompt 构建逻辑
- [ ] 集成 AI API 调用（包含 aspect_ratio 参数）
- [ ] 实现任务轮询
- [ ] 实现图片展示和下载

### 9.2 第二阶段：用户系统（优先级：高）
- [ ] 集成积分系统
- [ ] 实现登录检查
- [ ] 实现权限检查
- [ ] 实现错误处理
- [ ] 验证积分自动回滚（失败时）

### 9.3 第三阶段：后台配置（优先级：中）
- [ ] 在系统后台启用新用户积分赠送配置
- [ ] 设置推荐配置：`initial_credits_enabled: true`, `initial_credits_amount: 10`
- [ ] 验证新用户注册后获得积分

### 9.4 第四阶段：测试和发布（优先级：高）
- [ ] 单元测试
- [ ] 集成测试
- [ ] E2E 测试
- [ ] 性能测试
- [ ] 发布到生产环境

---

## 10. 附录

### 10.1 参考资料
- 现有 `ImageGenerator` 组件：`src/shared/blocks/generator/image.tsx`
- kie.ai API 文档：https://kie.ai/nano-banana-pro
- Neon 数据库文档
- Cloudflare R2 文档

### 10.2 术语表
- **涂色页**：黑白线稿图片，供儿童填色使用
- **幼儿**：3-5 岁儿童
- **儿童**：6-10 岁儿童
- **积分**：用户账户中的虚拟货币，用于支付 AI 生成服务
- **竖版（portrait）**：高度大于宽度的纵向图片，适合 A4 纸竖向打印
- **横版（landscape）**：宽度大于高度的横向图片，适合 A4 纸横向打印
- **正方形（square）**：宽度和高度相等的图片
- **高分辨率**：最短边 ≥ 1024px，适合打印
- **新手积分**：新用户注册时根据后台配置赠送的积分

### 10.3 关键技术决策

#### 10.3.1 为什么使用现有的积分赠送配置？
- 系统已有完整的新用户积分赠送机制（`credit.ts` line 324-350）
- 后台可配置是否启用、赠送数量、有效期等（`settings.ts` line 336-360）
- 默认配置：`initial_credits_enabled: false`，需要管理员手动启用
- 推荐配置：启用并设置 10 积分（可生成 5 次涂色页）
- 前端文案使用通用描述"注册即可获得新手积分"，避免硬编码具体次数
- 符合现有架构，无需修改注册逻辑

#### 10.3.2 为什么未登录按钮可点击而不是禁用？
- 禁用按钮无法点击，无法引导用户登录
- 可点击按钮可以打开登录/注册弹窗，提升转化率
- 按钮文案和图标明确表达"需要登录"的含义
- 未登录时按钮始终可点击，即使主题为空
- 符合常见 UX 模式

#### 10.3.3 为什么积分不足时按钮不禁用？
- 禁用按钮无法触发点击事件，无法显示错误提示
- 通过点击时检查积分并显示 Toast 提示，用户体验更好
- 可以在提示中引导用户充值
- 只有主题为空和正在生成中时才禁用按钮

#### 10.3.4 为什么消耗 2 积分？
- 与现有 text-to-image 场景保持一致（`route.ts` line 49）
- 后端根据 `scene` 自动计算积分消耗
- 避免修改后端扣费逻辑

#### 10.3.5 为什么使用 aspect_ratio 而不是 width/height？
- kie.ai 适配层只读取 `aspect_ratio` 和 `resolution` 参数（`kie.ts` line 156-164）
- `width` 和 `height` 参数会被忽略
- 根据用户选择的比例传递对应的 aspect_ratio 值（portrait/landscape/square）
- 实际输出分辨率由 kie.ai 服务决定

#### 10.3.6 积分回滚机制
- 后端在 `updateAITaskById` 中自动处理（`ai_task.ts` line 60）
- 任务状态变为 `failed` 时触发
- 通过数据库事务保证原子性
- 状态更新依赖：前端轮询 `/api/ai/query` 查询任务状态
- 当前系统不依赖 webhook 回调，仅通过轮询更新状态
- 前端无需额外处理

#### 10.3.7 高分辨率的量化标准
- 定义为：最短边 ≥ 1024px
- 验收时检查生成图片的实际尺寸
- kie.ai 的 `resolution: "high"` 通常输出 1024px 以上
- 如果实际输出低于此标准，需要调整 API 参数或更换模型

### 10.4 变更记录

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|---------|------|
| 1.0 | 2026-02-20 | 初始版本 | - |
| 1.1 | 2026-02-20 | 修复评审问题：移除游客免费试用、修正积分消耗为2、修正分辨率为A4比例、明确积分回滚机制、修复进度倒退问题、补充i18n错误文案 | - |
| 1.2 | 2026-02-20 | 修复第二轮评审问题：改用aspect_ratio/resolution参数（符合kie适配层实现）、明确积分回滚依赖任务状态更新机制、移除遗留的免费试用i18n文案、调整验收标准为"竖向比例"而非精确像素 | - |
| 1.3 | 2026-02-20 | 修复第三轮评审问题：通过新用户注册赠送10积分实现试用（可生成5次）、统一未登录按钮文案、修正数据库字段说明、明确仅依赖轮询更新状态、量化高分辨率标准为最短边≥1024px | - |
| 1.4 | 2026-02-20 | 修复第四轮评审问题：未登录按钮改为可点击（打开登录弹窗）、使用现有积分赠送配置（避免硬编码）、文案改为通用描述"注册即可获得新手积分"（不承诺具体次数）、明确依赖后台配置启用 | - |
| 1.5 | 2026-02-20 | 修复第五轮评审问题：积分不足时按钮不禁用（点击时显示错误提示）、未登录按钮始终可点击（即使主题为空）、修正配置默认值说明（valid_days无默认值，0表示永久有效） | - |
| 1.6 | 2026-02-20 | 新增功能：添加图片比例选择器（竖版/横版/正方形）、完善测试用例（图片尺寸验证、防御性校验测试、比例验证）、添加测试代码示例 | - |
| 1.7 | 2026-02-20 | 最终审查：强化square aspect_ratio风险提示（包含备选方案）、确认实施计划已包含比例选择器、确认函数签名正确（aspect_ratio不进入prompt） | - |
| 1.8 | 2026-02-20 | 收口修复：将square标注为实验性功能（可降级）、修正决策说明为"根据所选比例传递aspect_ratio"、改进防御性测试方法为可执行方式（E2E工具/API直调/DOM修改） | - |
| 1.9 | 2026-02-20 | 最终对齐：明确后端校验行为（options存在时不拦截空prompt，由provider层校验）、前端需映射provider原始错误为友好提示、验收项明确square可降级不计失败、添加错误映射函数 | - |
| 2.0 | 2026-02-20 | 策略明确化：定义square降级单一路径（square→1:1→portrait+提示）、固定错误映射规则（包含"prompt"→"请输入涂色页主题"，其他→"生成失败，请重试"）、避免实现分叉和测试不稳定 | - |
| 2.1 | 2026-02-20 | 彻底消除分叉：移除"隐藏正方形选项"备选方案，明确不隐藏UI保持一致性、补充API测试鉴权前提（需携带有效登录会话或测试账号）、确保单一实现路径 | - |
| 2.2 | 2026-02-20 | 修复测试期望冲突：正方形测试改为条件化断言（未降级断言width≈height，已降级断言提示文案+height>width），避免验收标准模糊 | - |
| 2.3 | 2026-02-20 | 明确错误处理优先级：API错误先走mapErrorMessage映射，未命中再显示通用提示，不直接显示原始错误信息，确保实现和测试期望一致 | - |
| 2.4 | 2026-02-20 | 增强鲁棒性：aspect_ratio降级优先使用结构化错误字段判断（文本匹配兜底）、错误映射支持不区分大小写和多种格式、补充鲁棒性测试用例、添加isAspectRatioError函数 | - |
| 2.5 | 2026-02-20 | 修复高优先级问题：prompt错误映射改为精确匹配（避免误判内容违规）、square降级覆盖异步失败路径（轮询阶段taskInfo错误）、补充i18n缺失文案（网络错误/降级提示）、修正API响应message为"ok"、拆分防御性测试场景（API原始错误vs前端映射提示） | - |
| 2.6 | 2026-02-20 | 修复一致性问题：统一错误处理优先级描述（line 372），改为精确匹配模式列表，与前文（line 348-353、line 459）保持完全一致，避免实现分叉 | - |
| 2.7 | 2026-02-20 | 补充实现注意事项：aspect_ratio异步降级必须做taskInfo字段缺失的防御性检查、mapErrorMessage单元测试应覆盖更多变体文案（标准格式/变体/带标点/误判场景）避免漏判 | - |
| 2.8 | 2026-02-20 | 修复语义冲突：aspect_ratio错误匹配改为"规范化后做子串匹配"（避免误解为整句精确等值）、测试段补充taskInfo需先JSON.parse的说明，与前文(lines 170-172)完全一致 | - |






