<script setup lang="ts">
import { AriaComponent, GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { BarChart, PieChart, TreemapChart } from 'echarts/charts'
import type { EChartsCoreOption } from 'echarts/core'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'

use([
  AriaComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  BarChart,
  PieChart,
  TreemapChart,
  CanvasRenderer,
])

const props = defineProps<{
  option: EChartsCoreOption
  chartLabel: string
}>()

const emit = defineEmits<{
  select: [payload: { itemId: string }]
}>()

function resolveItemId(params: unknown) {
  if (!params || typeof params !== 'object' || !('data' in params)) {
    return ''
  }

  const data = params.data

  if (!data || typeof data !== 'object' || !('itemId' in data)) {
    return ''
  }

  return typeof data.itemId === 'string' ? data.itemId : ''
}

function handleClick(params: unknown) {
  const itemId = resolveItemId(params)

  if (!itemId) {
    return
  }

  emit('select', { itemId })
}
</script>

<template>
  <VChart
    class="analysis-chart"
    :option="props.option"
    :aria-label="props.chartLabel"
    autoresize
    @click="handleClick"
  />
</template>

<style scoped>
.analysis-chart {
  width: 100%;
  height: 320px;
}
</style>
