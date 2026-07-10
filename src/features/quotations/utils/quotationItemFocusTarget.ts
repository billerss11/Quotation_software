const ITEM_FOCUS_ANCHOR_ATTRIBUTE = 'data-item-focus-anchor'
const ITEM_ID_ATTRIBUTE = 'data-item-id'

export function findQuotationItemFocusElement(root: ParentNode, itemId: string) {
  return queryItemElement(root, ITEM_FOCUS_ANCHOR_ATTRIBUTE, itemId)
    ?? queryItemElement(root, ITEM_ID_ATTRIBUTE, itemId)
}

function queryItemElement(root: ParentNode, attribute: string, itemId: string) {
  return root.querySelector<HTMLElement>(`[${attribute}="${escapeAttributeValue(itemId)}"]`)
}

function escapeAttributeValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}
