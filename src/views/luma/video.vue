 <script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import VoInput from './voInput.vue'
import VoList from './voList.vue'
import createMiraclesVideo from './createMiraclesVideo.vue'
import { NButton } from 'naive-ui'
import { SvgIcon } from '@/components/common'

const route = useRoute()
const router = useRouter()

const isCreateMiracles = computed(() => route.path.includes('create-miracles'))

const goToCreateMiracles = () => {
  router.push('/video/create-miracles')
}

const goToClassic = () => {
  router.push('/video')
}
 </script>
<template>
  <div class="flex w-full h-full video-content">
    <!-- 经典模式 -->
    <template v-if="!isCreateMiracles">
      <div class="w-[300px] h-full overflow-y-auto vo-input">
        <VoInput />
      </div>
      <div class="flex-1 h-full bg-[#fafbfc] pt-2 dark:bg-[#18181c] overflow-y-auto video-list relative">
        <!-- 切换按钮 -->
        <div class="absolute top-4 right-4 z-10">
          <NButton type="primary" @click="goToCreateMiracles">
            <template #icon>
              <SvgIcon icon="mdi:sparkles" />
            </template>
            创建奇迹模式
          </NButton>
    </div>
        <VoList />
    </div>
    </template>

    <!-- 创建奇迹模式 -->
    <template v-else>
      <div class="absolute top-4 left-4 z-10">
        <NButton @click="goToClassic">
          <template #icon>
            <SvgIcon icon="mdi:arrow-left" />
          </template>
          返回经典模式
        </NButton>
      </div>
      <createMiraclesVideo />
    </template>
</div>
</template> 