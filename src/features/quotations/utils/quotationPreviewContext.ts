import type { InjectionKey, Ref } from 'vue'

export interface QuotationContinuousPreviewContext {
  scrollElement: Readonly<Ref<HTMLElement | null>>
  scale: Readonly<Ref<number>>
}

/** Lets large interactive previews virtualize rows without changing exported documents. */
export const quotationContinuousPreviewKey: InjectionKey<QuotationContinuousPreviewContext> = Symbol('quotation-continuous-preview')
