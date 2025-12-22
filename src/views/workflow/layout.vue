<script setup lang='ts'>
import { computed } from 'vue'
import { NLayout, NLayoutContent } from 'naive-ui'
import { useBasicLayout } from '@/hooks/useBasicLayout'
import { homeStore, useAppStore, useAuthStore } from '@/store'
import { aiSider ,aiFooter} from '@/views/mj'
import aiMobileMenu from '@/views/mj/aiMobileMenu.vue'
import Permission from '@/views/chat/layout/Permission.vue'

homeStore.setMyData({ local: 'workflow' })
const { isMobile } = useBasicLayout()
const appStore = useAppStore()
const authStore = useAuthStore()

const collapsed = computed(() => appStore.siderCollapsed)
const needPermission = computed(() => !!authStore.session?.auth && !authStore.token)

const getMobileClass = computed(() => {
  if (isMobile.value)
    return ['rounded-none', 'shadow-none']
  return ['shadow-md', 'dark:border-neutral-800']
})

const getContainerClass = computed(() => {
  return [
    'h-full',
    { 'abc': !isMobile.value && !collapsed.value },
  ]
})
</script>

<template>
  <div class="dark:bg-transparent bg-transparent transition-all p-0" :class="[isMobile ? 'h55' : 'h-full']">
    <div class="h-full overflow-hidden" :class="getMobileClass">
      <NLayout class="z-40 transition" :class="getContainerClass" has-sider :sider-placement="isMobile?'left': 'right'">
        <aiSider v-if="!isMobile"/>
        <NLayoutContent class="h-full">
          <RouterView v-slot="{ Component, route }">
            <component :is="Component" :key="route.fullPath" />
          </RouterView>
        </NLayoutContent>
      </NLayout>
    </div>
    <Permission :visible="needPermission" />
  </div>
  <aiMobileMenu v-if="isMobile" />
  <aiFooter/>
</template>

<style>
.h55{
  height: calc(100% - 55px);
}
</style>



