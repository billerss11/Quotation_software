export const enUsUserManual = {
  title: 'User Manual',
  description: 'Follow the illustrated steps to create, check, save, and reuse quotations. The screenshots use a saved sample quotation to show a realistic workflow.',
  contents: 'What would you like to do?',
  step: 'Step {number}',
  enlarge: 'Enlarge screenshot',
  close: 'Close',
  backToEditor: 'Back to editor',
  screenshotHint: 'Click a screenshot to enlarge it. The outline shows where to look or click.',
  topics: {
    open: {
      title: 'Open a saved quotation',
      intro: 'Load a quotation saved in this app profile, then become familiar with the main work areas.',
    },
    setup: {
      title: 'Start and set up a quotation',
      intro: 'Create a separate quotation and enter the document, sender, and customer information before pricing items.',
    },
    items: {
      title: 'Add and organize items',
      intro: 'Add priced items, enter their quantities and costs, and use children when a main item is made up of smaller parts.',
    },
    pricing: {
      title: 'Set pricing, tax, and currencies',
      intro: 'Choose the quotation-wide markup and tax rules, then check every exchange rate used by item costs.',
    },
    review: {
      title: 'Check and preview the quotation',
      intro: 'Use the analysis and customer preview to find missing information and confirm what the customer will receive.',
    },
    save: {
      title: 'Save, transfer, or reopen a quotation',
      intro: 'Keep a quotation JSON file as your durable copy and reopen it when you need to continue or prepare a revision.',
    },
    import: {
      title: 'Import line items from Excel or CSV',
      intro: 'Use the supplied template to replace many line items at once, with a validation report before anything changes.',
    },
    receipt: {
      title: 'Generate a goods receipt',
      intro: 'Turn eligible quotation items into a separate receiving document without changing quotation prices or quantities.',
    },
    settings: {
      title: 'Manage settings and reusable records',
      intro: 'Set application preferences and save company and customer details for use in future quotations.',
    },
  },
  steps: {
    'open-menu': {
      title: 'Load the latest local draft',
      body: 'In Editor, click the three-dot More actions button, then click Load Latest. This loads the most recently saved draft in the current app or browser profile; it does not search Windows folders for the newest JSON file.',
      alt: 'Quotation editor with the More actions menu open and Load Latest available.',
    },
    overview: {
      title: 'Recognize the main work areas',
      body: 'The top bar shows the quotation, customer, and file status. Use Editor for entry, Analysis for checks, the center area for Line Items, and the right-side Details, Pricing, and Structure groups for supporting information. This sample illustrates the workflow and currently has 69 incomplete entries; review every incomplete row and all prices before sending it.',
      alt: 'Loaded sample quotation showing the command bar, line items, support panels, and incomplete-item count.',
    },
    'new-menu': {
      title: 'Start a separate quotation',
      body: 'Save the current quotation first if you need to keep it. Click the three-dot More actions button, then click New. The editor creates a new quotation number and starts with a blank item.',
      alt: 'More actions menu open with the New command at the top.',
    },
    'quote-info': {
      title: 'Complete Quote info',
      body: 'Open the Details group and click Quote info. Check Quotation number, Revision, Quotation date, Project name, Document language, Document template, Preview/PDF item detail, Validity period, and Currency. The values shown in the sample are examples, so replace them with the new quotation details.',
      alt: 'Quote info panel showing the quotation number, project, document, validity, and currency fields.',
    },
    parties: {
      title: 'Enter sender and customer details',
      body: 'In Details, click Parties. Review the Quotation company snapshot under From company. Under To customer, fill Customer company, Contact person, and Contact details. To create reusable choices, click Manage profiles or Manage customers and add the records in Settings.',
      alt: 'Parties panel showing the sender company snapshot and editable customer fields.',
    },
    'add-item': {
      title: 'Add a main item',
      body: 'In the Line Items area, click Add item. A new root item appears at the bottom of the quotation. Use a root item for a standalone chargeable item or for a main group that will contain children.',
      alt: 'Line Items toolbar with the Add item button.',
    },
    'edit-item': {
      title: 'Enter the item and its price inputs',
      body: 'For the example, enter Site inspection as the item name, Quantity 2, Unit DAY, Pricing basis Cost + markup, Unit cost 250, and Cost FX USD. Leave Markup override blank to use the parent or Global markup. Use Final price and Final unit price only when you already know the customer selling price.',
      alt: 'Site inspection item filled with quantity two, DAY unit, USD cost, and cost-plus pricing.',
    },
    'add-child': {
      title: 'Add a child item',
      body: 'On the Site inspection item, click Add child item. Enter Inspector as the child name, then complete the child quantity, unit, and pricing fields. You can add another child to a level-two row when a third detail level is needed.',
      alt: 'Site inspection item with the Add child item button highlighted.',
    },
    hierarchy: {
      title: 'Understand group rollups',
      body: 'After an item has children, it becomes a group. Its direct Unit cost or Final unit price no longer controls the amount; the priced children roll up into the parent total. Check the Inspector row and any other children because their quantities and prices now determine the Site inspection amount.',
      alt: 'Expanded parent and child hierarchy showing child pricing rolled into the parent summary.',
    },
    pricing: {
      title: 'Set markup and tax',
      body: 'Open Pricing > Pricing & tax and enter Global markup. Under Tax mode, choose Single tax and enter Tax / VAT, or choose Mixed tax to use multiple rates. For mixed tax, click Add tax class and assign the correct Tax class to each applicable item. Use Add charge for shipping or another fixed amount added after tax.',
      alt: 'Pricing and tax panel showing markup, tax mode, tax classes, and extra charges.',
    },
    fx: {
      title: 'Check exchange rates',
      body: 'In Pricing, click FX rates. Read each row as one unit of the source currency equals the shown amount in the quotation Currency. Click Add currency when needed, or Fetch latest rates for available reference rates. The base currency stays at 1; review every rate before relying on the totals.',
      alt: 'FX rates panel showing the base currency, exchange-rate rows, and currency actions.',
    },
    analysis: {
      title: 'Review warnings and totals',
      body: 'Click Analysis in the top workspace switch. Start with Top checks, Cost visibility, and the summary totals, then click an affected item to return to it in Editor. Analysis helps you find likely problems, but it does not approve the quotation automatically; resolve the incomplete-item count and verify the entered prices yourself.',
      alt: 'Analysis workspace showing quotation checks, key totals, and cost visibility.',
    },
    'preview-options': {
      title: 'Choose what the customer will see',
      body: 'Return to Editor, open Details, and select Quote info. Choose Document language, Document template, and Preview/PDF item detail. Level 1 only gives a short summary; Levels 1-3 shows all item levels. Hidden children still remain included in rolled-up totals.',
      alt: 'Quote info panel with document language, template, and preview detail options.',
    },
    'preview-document': {
      title: 'Inspect the customer document',
      body: 'Click Preview and use 100% when you want to inspect the document at actual size. Check the sender and customer, items, tax, notes, terms, and final total. App language and Document language are independent, so a Chinese interface can still preview an English quotation; change Document language in Details > Quote info. In the browser, click Print; the desktop equivalent is Export PDF. Do not send the sample until its incomplete rows and prices have been reviewed.',
      alt: 'Customer-facing quotation preview with document controls and the Print action.',
    },
    save: {
      title: 'Save a durable quotation copy',
      body: 'In the browser shown here, click Download to save the complete quotation as JSON. In the desktop app, click Save; use More actions > Save As when you want a separate revision file. Keep this JSON file in a backed-up folder because a local draft belongs only to the current app profile.',
      alt: 'Quotation command bar showing the browser Download action.',
    },
    'import-quotation': {
      title: 'Open a quotation JSON file',
      body: 'Save the current work first, then click the three-dot More actions button and choose Import Quotation. Select the saved quotation JSON file. The imported quotation replaces the current working quotation. Use Load Latest only when you want the latest local draft from this app profile.',
      alt: 'More actions menu showing Import Quotation and Load Latest.',
    },
    'import-dialog': {
      title: 'Import many line items',
      body: 'Save the current quotation first, then click More actions > Import line items. Download Excel template is recommended. Fill one item per row, save the workbook, click Import Excel, and review all errors and warnings. Click Import these items only when the report is correct. Confirmation replaces the current items and sections; it does not merge them, while quotation details and parties remain.',
      alt: 'Import items dialog with template downloads, file import buttons, instructions, and confirmation area.',
    },
    'receipt-open': {
      title: 'Open the goods receipt tool',
      body: 'Make sure the quotation has usable positive-quantity items, then click Generate GR in the command bar. The button is unavailable when no quotation item can be used for a receipt.',
      alt: 'Quotation command bar with the Generate GR button.',
    },
    'receipt-dialog': {
      title: 'Complete the receipt details',
      body: 'At the top of Generate Goods Receipt, choose Template Standard or Compact. Review GR No. and Document date, then check Customer PO / Reference, Project name, and Delivery reference. The form copies available quotation details, but you should check and complete them for this delivery.',
      alt: 'Generate Goods Receipt dialog showing template and receipt-detail fields beside the live preview.',
    },
    'receipt-selection': {
      title: 'Choose the receipt lines',
      body: 'Scroll the left panel to Goods received. Under Receipt detail, choose Summary — main items; Grouped — sub-items and Detailed — individual items are available when you need more detail. The sample now includes three receipt lines, each with a pencil button. Confirm that the included descriptions and quoted quantities match this delivery before editing a line.',
      alt: 'Goods received section with Summary selected, three included receipt lines, and a pencil button on each line.',
    },
    'receipt-items': {
      title: 'Customize a line and output the receipt',
      body: 'Click the first pencil button to open Customize receipt line 1. Adjust Qty, Unit, Description, or Remarks only for this receipt, then check the PDF preview on the right. Fix any errors and click Print GR in the browser footer. The desktop equivalent is Export GR PDF.',
      alt: 'Customize receipt line 1 panel with quantity, unit, description, remarks, the PDF preview, and Print GR.',
    },
    settings: {
      title: 'Choose application preferences and back up records',
      body: 'Click Settings in the left navigation, then open General. Choose App language and App theme. App language changes the interface only; set each quotation’s Document language in Details > Quote info. Under Backup and transfer, use Save backup as to protect reusable company profiles, customers, and numbering. This library backup is separate from quotation JSON files.',
      alt: 'General settings showing app language, app theme, and backup and transfer actions.',
    },
    company: {
      title: 'Create a reusable company profile',
      body: 'In Settings, click Company Profiles, then New profile. Enter Company Name, optional Contact Number, and optional Email, then click Save profile. Later, choose it from Parties > Choose company profile to copy its details into a quotation snapshot.',
      alt: 'Company Profiles settings with a new company profile form and Save profile button.',
    },
    customers: {
      title: 'Create a reusable customer',
      body: 'In Settings, click Customers, then New customer. Enter Company, Contact Person, and Contact Details; at least Company or Contact Person is required. Click Save record. Later, use Parties > Choose from library to copy the customer into the current quotation.',
      alt: 'Customers settings with a new customer form and Save record button.',
    },
  },
}

export const zhCnUserManual = {
  title: '用户手册',
  description: '按照图示步骤创建、检查、保存和复用报价。截图使用一份已保存的示例报价，展示实际操作流程。',
  contents: '您想完成什么操作？',
  step: '第 {number} 步',
  enlarge: '放大截图',
  close: '关闭',
  backToEditor: '返回编辑器',
  screenshotHint: '点击截图可放大查看。方框标出需要查看或点击的位置。',
  topics: {
    open: {
      title: '打开已保存的报价',
      intro: '加载保存在当前应用资料中的报价，然后熟悉主要工作区域。',
    },
    setup: {
      title: '新建并填写报价资料',
      intro: '先创建一份独立报价，填写文档、报价方和客户信息，再开始给项目定价。',
    },
    items: {
      title: '添加和整理项目',
      intro: '添加计价项目，填写数量与成本；当一个主项目由多个部分组成时，可以添加子项。',
    },
    pricing: {
      title: '设置定价、税率和币种',
      intro: '设置整份报价的加价和税务规则，然后检查项目成本使用的每一个汇率。',
    },
    review: {
      title: '检查并预览报价',
      intro: '使用分析和客户预览查找缺失资料，并确认客户最终会看到的内容。',
    },
    save: {
      title: '保存、传输或重新打开报价',
      intro: '把报价 JSON 文件作为长期保存副本，需要继续编辑或制作修订版时再重新打开。',
    },
    import: {
      title: '从 Excel 或 CSV 导入明细',
      intro: '使用应用提供的模板一次替换多个明细；确认前，应用会先显示检查报告。',
    },
    receipt: {
      title: '生成收货单',
      intro: '把符合条件的报价项目生成独立收货文件，不会改变报价中的价格或数量。',
    },
    settings: {
      title: '管理设置和可复用资料',
      intro: '设置应用偏好，并保存公司和客户资料，供以后的报价重复使用。',
    },
  },
  steps: {
    'open-menu': {
      title: '加载最近的本地草稿',
      body: '在“编辑器”中点击三个点的“更多操作”按钮，再点击“加载最近稿”。它会加载当前应用或浏览器资料中最近保存的草稿；它不会到 Windows 文件夹中寻找最新的 JSON 文件。',
      alt: '报价编辑器已打开“更多操作”菜单，其中显示“加载最近稿”。',
    },
    overview: {
      title: '认识主要工作区域',
      body: '顶部栏显示报价、客户和文件状态。“编辑”用于录入，“分析”用于检查，中间是“明细项目”，右侧“资料”“定价”和“结构”组提供辅助设置。此示例仅用于演示流程，目前有 69 项未完整；发送前必须逐项补齐并核对所有价格。',
      alt: '已加载的示例报价，显示命令栏、明细项目、辅助面板和未完整项目数量。',
    },
    'new-menu': {
      title: '开始一份独立报价',
      body: '如需保留当前报价，请先保存。点击三个点的“更多操作”按钮，再点击“新建”。编辑器会生成新的报价编号，并放入一个空白项目。',
      alt: '“更多操作”菜单已打开，顶部显示“新建”命令。',
    },
    'quote-info': {
      title: '填写“报价信息”',
      body: '打开“资料”组并点击“报价信息”。检查“报价编号”“修订”“报价日期”“项目名称”“文档语言”“文件模板”“预览/PDF 项目明细”“有效期”和“币种”。截图中的示例值只供参考，请改成新报价的实际资料。',
      alt: '“报价信息”面板，显示报价编号、项目、文档、有效期和币种字段。',
    },
    parties: {
      title: '填写报价方和客户资料',
      body: '在“资料”中点击“双方”。在“报价方公司”下面检查“报价单公司快照”；在“客户方”下面填写“客户公司”“联系人”和“联系方式”。如需建立可复用选项，请点击“管理公司资料”或“管理客户”，再到“设置”中添加记录。',
      alt: '“双方”面板，显示报价方公司快照和可编辑的客户字段。',
    },
    'add-item': {
      title: '添加主项目',
      body: '在“明细项目”区域点击“添加项目”。新的一级项目会出现在报价末尾。一级项目可以是独立计价项目，也可以作为包含多个子项的主分组。',
      alt: '“明细项目”工具栏中的“添加项目”按钮。',
    },
    'edit-item': {
      title: '填写项目和计价资料',
      body: '本示例把项目名称填写为 Site inspection，“数量”填 2，“单位”填 DAY，“计价方式”选“成本 + 加价”，“单价成本”填 250，“成本币种”选 USD。“加价覆盖”留空时会使用上级或“全局加价”。只有已经知道客户售价时，才选择“最终价”并填写“最终单价”。',
      alt: 'Site inspection 项目已填写数量 2、单位 DAY、USD 成本和成本加价计价方式。',
    },
    'add-child': {
      title: '添加子项',
      body: '在 Site inspection 项目上点击“添加子项”。把子项名称填写为 Inspector，再完成子项的数量、单位和计价字段。如需第三级明细，可以在二级项目上继续添加子项。',
      alt: 'Site inspection 项目的“添加子项”按钮已标出。',
    },
    hierarchy: {
      title: '理解分组汇总',
      body: '项目有了子项后，就会变成分组。父项本身的“单价成本”或“最终单价”不再决定金额；已计价的子项会汇总到父项。请检查 Inspector 和其他子项，因为它们的数量与价格现在决定 Site inspection 的金额。',
      alt: '展开的父子项目层级，显示子项价格汇总到父项摘要。',
    },
    pricing: {
      title: '设置加价和税率',
      body: '打开“定价”中的“定价与税”，填写“全局加价”。在“税务模式”中选择“单一税率”并填写“税额 / 增值税”；如需多个税率，选择“混合税率”，点击“新增税率类别”，并为适用项目选择正确的“税率类别”。运输费等税后固定金额可用“添加费用”录入。',
      alt: '“定价与税”面板，显示加价、税务模式、税率类别和额外费用。',
    },
    fx: {
      title: '检查汇率',
      body: '在“定价”中点击“汇率”。每一行表示 1 单位来源币种等于多少报价“币种”。需要时点击“添加币种”，或点击“获取最新汇率”取得可用参考值。基准币种固定为 1；使用合计金额前，请逐一核对汇率。',
      alt: '“汇率”面板，显示基准币种、汇率行和币种操作。',
    },
    analysis: {
      title: '检查提醒和合计',
      body: '点击顶部工作区切换中的“分析”。先查看“重点检查”“成本可见度”和汇总金额，再点击受影响项目返回“编辑”检查。分析可以帮助发现问题，但不会自动批准报价；仍需处理未完整项目并亲自核对输入价格。',
      alt: '“分析”工作区，显示报价检查、主要金额和成本可见度。',
    },
    'preview-options': {
      title: '选择客户可见内容',
      body: '返回“编辑”，打开“资料”，再选择“报价信息”。设置“文档语言”“文件模板”和“预览/PDF 项目明细”。“仅显示一级”适合简短汇总；“显示一至三级”会显示所有层级。隐藏的子项仍然包含在汇总金额中。',
      alt: '“报价信息”面板中的文档语言、文件模板和预览明细选项。',
    },
    'preview-document': {
      title: '检查客户文件',
      body: '点击“预览”；需要按实际大小检查文件时，选择“100%”。检查报价方与客户、项目、税额、备注、条款和最终合计。“界面语言”和“文档语言”互相独立，因此中文界面也可以预览英文报价；可在“资料”>“报价信息”中更改“文档语言”。浏览器中点击“打印”，桌面应用中的对应命令是“导出 PDF”。示例中的未完整项目和价格未核对前，不要发送。',
      alt: '面向客户的报价预览，显示文件控制和“打印”操作。',
    },
    save: {
      title: '保存长期使用的报价副本',
      body: '当前浏览器截图中，点击“下载”可把完整报价保存为 JSON。桌面应用中请点击“保存”；需要保留独立修订文件时，使用“更多操作”>“另存为”。请把 JSON 放在有备份的文件夹中，因为本地草稿只属于当前应用资料。',
      alt: '报价命令栏显示浏览器中的“下载”操作。',
    },
    'import-quotation': {
      title: '打开报价 JSON 文件',
      body: '先保存当前工作，再点击三个点的“更多操作”按钮并选择“导入报价”，然后选择已保存的报价 JSON。导入后会替换当前正在编辑的报价。只有需要当前应用资料中的最近本地草稿时，才使用“加载最近稿”。',
      alt: '“更多操作”菜单显示“导入报价”和“加载最近稿”。',
    },
    'import-dialog': {
      title: '批量导入明细项目',
      body: '先保存当前报价，再点击“更多操作”>“导入明细”。建议先点击“下载 Excel 模板”。每行填写一个项目并保存工作簿，然后点击“导入 Excel”，查看全部错误和提醒。报告正确后才点击“导入这些项目”。确认后会替换当前项目和分区，不会合并；报价资料和双方信息会保留。',
      alt: '“导入项目”对话框，显示模板下载、文件导入、填写说明和确认区域。',
    },
    'receipt-open': {
      title: '打开收货单工具',
      body: '先确认报价中有数量为正且可用的项目，再点击命令栏中的“生成收货单”。如果没有可以用于收货单的报价项目，此按钮不可用。',
      alt: '报价命令栏中的“生成收货单”按钮。',
    },
    'receipt-dialog': {
      title: '填写收货单资料',
      body: '在“生成收货单”顶部，把“模板”选为“标准”或“紧凑”。检查“收货单号”和“制单日期”，再检查“客户采购单 / 参考号”“项目名称”和“送货参考”。表单会带入已有报价资料，但仍需按本次交付检查并补充。',
      alt: '“生成收货单”对话框，左侧显示模板和收货单字段，右侧是实时预览。',
    },
    'receipt-selection': {
      title: '选择收货明细',
      body: '向下滚动左侧面板到“收货明细”。在“收货明细程度”中选择“简要 — 主项目”；需要更多层级时，也可以选择“分组 — 子项目”或“详细 — 单个项目”。示例现在包含 3 条收货明细，每条旁边都有铅笔按钮。编辑前先确认已包含的描述和报价数量符合本次交付。',
      alt: '“收货明细”区域已选择“简要 — 主项目”，包含 3 条明细，每条都有铅笔按钮。',
    },
    'receipt-items': {
      title: '自定义明细并输出收货单',
      body: '点击第一条明细的铅笔按钮，打开“自定义收货明细 1”。按本次收货情况调整“数量”“单位”“描述”或“备注”，再检查右侧 PDF 预览。修正所有错误后，在浏览器底部点击“打印收货单”；桌面应用中的对应按钮是“导出收货单 PDF”。',
      alt: '“自定义收货明细 1”面板显示数量、单位、描述、备注、PDF 预览和“打印收货单”。',
    },
    settings: {
      title: '选择应用偏好并备份资料',
      body: '点击左侧导航中的“设置”，再打开“常规”。选择“界面语言”和“应用主题”。“界面语言”只改变应用界面；每份报价的“文档语言”请在“资料”>“报价信息”中设置。在“备份与传输”中使用“备份另存为”，保护公司资料、客户和编号状态。资料库备份与报价 JSON 文件是两种不同的文件。',
      alt: '“常规”设置，显示界面语言、应用主题和备份与传输操作。',
    },
    company: {
      title: '创建可复用公司资料',
      body: '在“设置”中点击“公司资料”，再点击“新建公司资料”。填写“公司名称”，并按需填写“联系电话”和“电子邮箱”，然后点击“保存资料”。以后可在“双方”>“选择公司资料”中把它复制为报价单快照。',
      alt: '“公司资料”设置，显示新建公司资料表单和“保存资料”按钮。',
    },
    customers: {
      title: '创建可复用客户',
      body: '在“设置”中点击“客户”，再点击“新建客户”。填写“公司”“联系人”和“联系方式”；“公司”和“联系人”至少填写一项。点击“保存记录”。以后可在“双方”>“从客户库选择”中把客户复制到当前报价。',
      alt: '“客户”设置，显示新建客户表单和“保存记录”按钮。',
    },
  },
}
