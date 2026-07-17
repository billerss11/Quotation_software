<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { LineItemsImportReport } from '../composables/useQuotationFileActions'

const props = defineProps<{
  report: LineItemsImportReport | null
  hasPendingImport: boolean
}>()

const emit = defineEmits<{
  chooseCsvFile: []
  chooseXlsxFile: []
  downloadTemplate: []
  downloadExcelTemplate: []
  confirm: []
  cancel: []
}>()

const visible = defineModel<boolean>('visible', { required: true })
const { t } = useI18n()

const entries = computed(() => props.report?.entries ?? [])
const errorCount = computed(() => entries.value.filter((entry) => entry.severity === 'error').length)
const warningCount = computed(() => entries.value.filter((entry) => entry.severity === 'warning').length)
const canConfirm = computed(() => props.hasPendingImport && errorCount.value === 0)
const reportSummary = computed(() => {
  const report = props.report
  if (!report) return ''

  if (report.status === 'ready') {
    return t('quotations.csv.report.readySummary', {
      fileName: report.fileName,
      rows: report.rowCount,
      warnings: warningCount.value,
    })
  }

  if (report.status === 'canceled') {
    return t('quotations.csv.report.canceledSummary', {
      fileName: report.fileName,
      rows: report.rowCount,
      warnings: warningCount.value,
    })
  }

  return t(
    report.status === 'imported'
      ? 'quotations.csv.report.successSummary'
      : 'quotations.csv.report.failedSummary',
    {
      fileName: report.fileName,
      errors: errorCount.value,
      warnings: warningCount.value,
    },
  )
})

const columnRows = computed(() => [
  'item_code',
  'item_name',
  'item_description',
  'qty',
  'qty_unit',
  'manual_unit_price',
  'unit_cost',
  'cost_currency',
  'tax_class',
  'markup_override',
].map((column) => ({
  column,
  description: t(`quotations.csv.guide.columns.${column}`),
})))

function closeDialog() {
  visible.value = false
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="t('quotations.csv.report.title')"
    :style="{ width: '900px' }"
    :breakpoints="{ '960px': '94vw' }"
    @hide="emit('cancel')"
  >
    <div class="csv-import-dialog">
      <section class="csv-import-guide">
        <p class="csv-import-warning">
          {{ t('quotations.csv.guide.replacementWarning') }}
        </p>

        <div class="csv-import-quick-start">
          <h3 class="csv-import-heading">
            {{ t('quotations.csv.guide.quickStartTitle') }}
          </h3>
          <ol class="csv-import-steps">
            <li>{{ t('quotations.csv.guide.stepDownload') }}</li>
            <li>{{ t('quotations.csv.guide.stepFill') }}</li>
            <li>{{ t('quotations.csv.guide.stepImport') }}</li>
          </ol>
          <p class="csv-import-pricing-summary">
            {{ t('quotations.csv.guide.pricingSummary') }}
          </p>
        </div>

        <div class="csv-import-file-actions">
          <Button
            severity="secondary"
            icon="pi pi-file-excel"
            :label="t('quotations.csv.guide.downloadExcelTemplate')"
            @click="emit('downloadExcelTemplate')"
          />
          <Button
            icon="pi pi-file-excel"
            :label="t(props.report ? 'quotations.csv.guide.chooseAnotherXlsx' : 'quotations.csv.guide.chooseXlsx')"
            @click="emit('chooseXlsxFile')"
          />
          <Button
            severity="secondary"
            icon="pi pi-download"
            :label="t('quotations.csv.guide.downloadTemplate')"
            @click="emit('downloadTemplate')"
          />
          <Button
            icon="pi pi-file-import"
            :label="t(props.report ? 'quotations.csv.guide.chooseAnotherCsv' : 'quotations.csv.guide.chooseCsv')"
            @click="emit('chooseCsvFile')"
          />
        </div>

        <details class="csv-import-details">
          <summary>{{ t('quotations.csv.guide.advancedTitle') }}</summary>
          <div class="csv-import-details-content">
            <ul class="csv-import-rules">
              <li>{{ t('quotations.csv.guide.headerRule') }}</li>
              <li>{{ t('quotations.csv.guide.unknownColumnRule') }}</li>
              <li>{{ t('quotations.csv.guide.numberRule') }}</li>
              <li>{{ t('quotations.csv.guide.percentRule') }}</li>
              <li>{{ t('quotations.csv.guide.hierarchyRule') }}</li>
              <li>{{ t('quotations.csv.guide.pricingRule') }}</li>
              <li>{{ t('quotations.csv.guide.inheritanceRule') }}</li>
              <li>{{ t('quotations.csv.guide.legacyRule') }}</li>
            </ul>

            <h3 class="csv-import-heading">
              {{ t('quotations.csv.guide.rowTypeTitle') }}
            </h3>
            <ul class="csv-import-rules">
              <li>{{ t('quotations.csv.guide.parentRule') }}</li>
              <li>{{ t('quotations.csv.guide.costPlusRule') }}</li>
              <li>{{ t('quotations.csv.guide.manualRule') }}</li>
            </ul>

            <h3 class="csv-import-heading">
              {{ t('quotations.csv.guide.columnTitle') }}
            </h3>
            <div class="csv-import-table-wrap">
              <table class="csv-import-table">
                <thead>
                  <tr>
                    <th scope="col">{{ t('quotations.csv.guide.tableColumn') }}</th>
                    <th scope="col">{{ t('quotations.csv.guide.tableValue') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in columnRows" :key="row.column">
                    <td><code>{{ row.column }}</code></td>
                    <td>{{ row.description }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </details>
      </section>

      <section v-if="props.report" class="csv-import-report">
        <p class="csv-import-report-summary">
          {{ reportSummary }}
        </p>

        <div class="csv-import-metadata">
          <span>{{ t('quotations.csv.report.rowCount', { count: props.report.rowCount }) }}</span>
          <span>
            {{ t('quotations.csv.report.recognizedColumns') }}:
            {{ props.report.recognizedColumns.join(', ') || t('quotations.csv.report.noColumns') }}
          </span>
          <span>
            {{ t('quotations.csv.report.ignoredColumns') }}:
            {{ props.report.ignoredColumns.join(', ') || t('quotations.csv.report.noColumns') }}
          </span>
        </div>

        <p v-if="entries.length === 0" class="csv-import-no-issues">
          {{ t('quotations.csv.report.noIssues') }}
        </p>
        <ul v-else class="csv-import-report-list">
          <li
            v-for="(entry, index) in entries"
            :key="`${entry.row}-${entry.severity}-${entry.column ?? 'row'}-${index}`"
            class="csv-import-report-entry"
            :class="`csv-import-report-entry--${entry.severity}`"
          >
            <span class="csv-import-report-severity">
              {{ t(`quotations.csv.report.${entry.severity}`) }}
            </span>
            <span>{{ t('quotations.csv.report.row', { row: entry.row }) }}</span>
            <code v-if="entry.column">{{ entry.column }}</code>
            <span>{{ entry.message }}</span>
          </li>
        </ul>
      </section>

      <div class="csv-import-dialog-actions">
        <Button
          severity="secondary"
          :label="t(props.hasPendingImport ? 'quotations.csv.guide.cancelImport' : 'quotations.csv.report.close')"
          @click="closeDialog"
        />
        <Button
          v-if="props.report?.status === 'ready'"
          icon="pi pi-check"
          :label="t('quotations.csv.guide.confirmImport')"
          :disabled="!canConfirm"
          @click="emit('confirm')"
        />
      </div>
    </div>
  </Dialog>
</template>

<style scoped>
.csv-import-dialog {
  display: grid;
  gap: 1.25rem;
}

.csv-import-guide,
.csv-import-report {
  display: grid;
  gap: 0.85rem;
}

.csv-import-warning {
  margin: 0;
  padding: 0.8rem 0.9rem;
  border-left: 4px solid var(--warning);
  background: var(--surface-hover);
  color: var(--text-body);
}

.csv-import-rules {
  margin: 0;
  padding-left: 1.25rem;
  display: grid;
  gap: 0.35rem;
}

.csv-import-heading {
  margin: 0.2rem 0 0;
  font-size: 1rem;
}

.csv-import-steps {
  margin: 0;
  padding-left: 1.4rem;
  display: grid;
  gap: 0.45rem;
}

.csv-import-pricing-summary {
  margin: 0;
  color: var(--text-muted);
}

.csv-import-quick-start,
.csv-import-details-content {
  display: grid;
  gap: 0.75rem;
}

.csv-import-details summary {
  cursor: pointer;
  font-weight: 600;
}

.csv-import-details-content {
  margin-top: 0.85rem;
}

.csv-import-table-wrap {
  overflow-x: auto;
}

.csv-import-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.csv-import-table th,
.csv-import-table td {
  padding: 0.55rem 0.65rem;
  border: 1px solid var(--surface-border);
  text-align: left;
  vertical-align: top;
}

.csv-import-file-actions,
.csv-import-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.65rem;
  flex-wrap: wrap;
}

.csv-import-report {
  padding-top: 1rem;
  border-top: 1px solid var(--surface-border);
}

.csv-import-report-summary,
.csv-import-no-issues {
  margin: 0;
}

.csv-import-metadata {
  display: grid;
  gap: 0.3rem;
  font-size: 0.9rem;
  color: var(--text-muted);
}

.csv-import-report-list {
  max-height: 260px;
  overflow: auto;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.45rem;
  list-style: none;
}

.csv-import-report-entry {
  display: grid;
  grid-template-columns: auto auto auto minmax(0, 1fr);
  gap: 0.5rem;
  align-items: start;
  padding: 0.55rem 0.65rem;
  border-left: 3px solid var(--surface-border);
  background: var(--surface-card);
}

.csv-import-report-entry--error {
  border-left-color: var(--danger);
}

.csv-import-report-entry--warning {
  border-left-color: var(--warning);
}

.csv-import-report-severity {
  font-weight: 700;
}

@media (max-width: 640px) {
  .csv-import-report-entry {
    grid-template-columns: auto 1fr;
  }
}
</style>
