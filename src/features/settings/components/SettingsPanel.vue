<script setup lang="ts">
import InputText from 'primevue/inputtext'

import type { CompanyProfile } from '@/shared/services/localCompanyProfileStorage'

const companyProfile = defineModel<CompanyProfile>({ required: true })
</script>

<template>
  <section class="settings-panel">
    <div class="panel-heading">
      <h2>Company Profile</h2>
      <p>One company profile is planned for the first production version.</p>
    </div>

    <form class="settings-form">
      <label class="field">
        <span>Company name</span>
        <InputText v-model="companyProfile.companyName" />
      </label>
      <label class="field">
        <span>Contact number</span>
        <InputText v-model="companyProfile.phone" />
      </label>
      <label class="field">
        <span>Email</span>
        <InputText v-model="companyProfile.email" />
      </label>
    </form>
  </section>
</template>

<style scoped>
.settings-panel {
  display: grid;
  gap: 20px;
}

.panel-heading,
.settings-form {
  padding: 20px;
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  background: #ffffff;
}

.panel-heading h2,
.panel-heading p {
  margin: 0;
}

.panel-heading p {
  margin-top: 6px;
  color: #64748b;
}

.settings-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.field {
  display: grid;
  gap: 7px;
  color: #475569;
  font-size: 13px;
  font-weight: 700;
}

.field :deep(.p-inputtext) {
  width: 100%;
}

.color-field {
  align-content: start;
}
</style>
