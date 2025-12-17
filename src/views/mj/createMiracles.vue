<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { NButton, NCard, NInput, NSelect, NImage, NGrid, NGridItem, useMessage, NModal, NSpin } from 'naive-ui'
import { SvgIcon } from '@/components/common'
import { useBasicLayout } from '@/hooks/useBasicLayout'
import { t } from '@/locales'
import { upImg, mjFetch, mlog } from '@/api'
import { homeStore, useChatStore } from '@/store'

const { isMobile } = useBasicLayout()
const message = useMessage()
const chatStore = useChatStore()

// 状态管理
const prompt = ref('')
const loading = ref(false)
const selectedAspectRatio = ref('16:9')
const selectedStyle = ref('')
const selectedQuality = ref('')
const uploadedImages = ref<string[]>([])
const generatedImages = ref<any[]>([])
const showImageModal = ref(false)
const selectedImage = ref('')

// 从聊天记录加载已生成的图片
const loadGeneratedImages = () => {
  const chats = chatStore.getChatByUuid(chatStore.active)
  const images: any[] = []
  
  chats.forEach((chat: Chat.Chat) => {
    if (!chat.inversion && chat.opt?.imageUrl) {
      images.push({
        id: chat.myid || Date.now(),
        url: chat.opt.imageUrl,
        prompt: chat.text || chat.requestOptions?.prompt || '',
        createdAt: chat.dateTime || new Date().toISOString(),
        taskId: chat.mjID,
      })
    }
  })
  
  generatedImages.value = images.reverse() // 最新的在前
}

// 监听聊天更新，更新图片状态
watch(
  () => homeStore.myData.act,
  (act, oldAct) => {
    if (act === 'updateChat' || act === 'draw') {
      // 延迟加载，确保数据已更新
      setTimeout(() => {
        const chats = chatStore.getChatByUuid(chatStore.active)
        chats.forEach((chat: Chat.Chat) => {
          if (!chat.inversion && chat.opt?.imageUrl) {
            // 更新对应任务的图片URL
            const image = generatedImages.value.find(img => img.taskId === chat.mjID)
            if (image && !image.url) {
              image.url = chat.opt.imageUrl
              image.loading = false
            }
          }
        })
        // 重新加载所有图片
        loadGeneratedImages()
      }, 500)
    }
  },
  { deep: true }
)

// 宽高比选项
const aspectRatios = [
  { label: '1:1', value: '1:1', icon: 'square' },
  { label: '4:3', value: '4:3', icon: 'landscape' },
  { label: '3:4', value: '3:4', icon: 'portrait' },
  { label: '16:9', value: '16:9', icon: 'wide' },
  { label: '9:16', value: '9:16', icon: 'tall' },
]

// 风格选项
const styleOptions = [
  { label: '写实', value: 'realistic' },
  { label: '动漫', value: 'anime' },
  { label: '油画', value: 'oil-painting' },
  { label: '水彩', value: 'watercolor' },
  { label: '素描', value: 'sketch' },
  { label: '3D渲染', value: '3d-render' },
]

// 质量选项
const qualityOptions = [
  { label: '标准', value: 'standard' },
  { label: '高清', value: 'hd' },
  { label: '超高清', value: 'ultra-hd' },
]

// 图片上传处理
const fileRef = ref<HTMLInputElement>()
const handleFileSelect = async (file: File) => {
  try {
    const result = await upImg(file)
    if (result?.url) {
      uploadedImages.value.push(result.url)
      message.success('图片上传成功')
    }
  } catch (error: any) {
    message.error(error?.message || '图片上传失败')
  }
}

// 生成图片
const generateImage = async () => {
  if (!prompt.value.trim()) {
    message.warning('请输入提示词')
    return
  }

  loading.value = true
  try {
    // 构建提示词，包含宽高比和风格信息
    let fullPrompt = prompt.value
    if (selectedAspectRatio.value) {
      fullPrompt += ` --ar ${selectedAspectRatio.value}`
    }
    if (selectedStyle.value) {
      fullPrompt += ` --style ${selectedStyle.value}`
    }
    if (selectedQuality.value) {
      fullPrompt += ` --quality ${selectedQuality.value}`
    }

    const params = {
      prompt: fullPrompt,
      base64Array: uploadedImages.value,
      notifyHook: '',
      state: '',
      botType: 'MID_JOURNEY',
    }

    // 调用后端API - 使用现有的 imagine 接口
    const response = await mjFetch('/mj/submit/imagine', params)
    
    if (response && response.result) {
      // 将任务添加到生成列表，等待结果
      generatedImages.value.unshift({
        id: response.result,
        url: '', // 等待生成完成后更新
        prompt: prompt.value,
        createdAt: new Date().toISOString(),
        taskId: response.result,
        loading: true,
      })
      message.success('图片生成任务已提交，请稍候...')
      
      // 使用现有的任务处理机制
      homeStore.setMyData({ 
        act: 'draw', 
        actData: { 
          taskId: response.result,
          prompt: prompt.value,
        } 
      })
    } else if (response?.code === 21) {
      // 需要模态确认
      message.info('请确认生成参数')
    }
  } catch (error: any) {
    mlog('generateImage error:', error)
    message.error(error?.error || error?.message || '图片生成失败')
  } finally {
    loading.value = false
  }
}

// 查看大图
const viewImage = (imageUrl: string) => {
  selectedImage.value = imageUrl
  showImageModal.value = true
}

// 删除图片
const removeUploadedImage = (index: number) => {
  uploadedImages.value.splice(index, 1)
}

// 清空输入
const clearInput = () => {
  prompt.value = ''
  uploadedImages.value = []
  selectedStyle.value = ''
  selectedQuality.value = ''
}

// 下载图片
const downloadImage = async (imageUrl: string) => {
  if (!imageUrl) {
    message.warning('图片尚未生成完成')
    return
  }
  try {
    // 如果是跨域图片，需要先获取blob
    const response = await fetch(imageUrl)
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `generated-image-${Date.now()}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    message.success('图片下载成功')
  } catch (error) {
    // 如果fetch失败，尝试直接下载
    try {
      const link = document.createElement('a')
      link.href = imageUrl
      link.download = `generated-image-${Date.now()}.png`
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      message.success('图片下载已开始')
    } catch (e) {
      message.error('图片下载失败')
    }
  }
}

// 组件挂载时加载图片
onMounted(() => {
  loadGeneratedImages()
})
</script>

<template>
  <div class="create-miracles-container h-full flex flex-col bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
    <!-- 头部 -->
    <div class="px-6 py-5 border-b border-gray-200/50 dark:border-gray-700/50 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            创建奇迹
          </h1>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">使用AI生成令人惊叹的图像</p>
        </div>
        <div class="flex items-center gap-2">
          <SvgIcon icon="mdi:sparkles" class="text-2xl text-purple-500" />
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-hidden flex">
      <!-- 左侧：输入面板 -->
      <div class="w-[420px] border-r border-gray-200/50 dark:border-gray-700/50 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm overflow-y-auto shadow-lg">
        <div class="p-6 space-y-6">
          <!-- 提示词输入 -->
          <div>
            <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <SvgIcon icon="mdi:lightbulb-on" class="text-blue-500" />
              提示词
            </label>
            <NInput
              v-model:value="prompt"
              type="textarea"
              :placeholder="'描述你想要生成的图像，例如：一只可爱的猫咪坐在窗台上，阳光洒在它的身上...'"
              :autosize="{ minRows: 5, maxRows: 10 }"
              class="w-full"
            />
            <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">提示：描述越详细，生成的图像越符合你的期望</p>
          </div>

          <!-- 宽高比选择 -->
          <div>
            <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <SvgIcon icon="mdi:aspect-ratio" class="text-purple-500" />
              宽高比
            </label>
            <div class="grid grid-cols-5 gap-2">
              <div
                v-for="ratio in aspectRatios"
                :key="ratio.value"
                @click="selectedAspectRatio = ratio.value"
                :class="[
                  'aspect-ratio-item p-3 rounded-xl border-2 cursor-pointer transition-all transform hover:scale-105',
                  selectedAspectRatio === ratio.value
                    ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 shadow-md'
                    : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 bg-white dark:bg-gray-700'
                ]"
              >
                <div class="flex flex-col items-center">
                  <SvgIcon 
                    :icon="`mdi:${ratio.icon}`" 
                    class="text-xl mb-1"
                    :class="selectedAspectRatio === ratio.value ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'"
                  />
                  <span 
                    class="text-xs font-medium"
                    :class="selectedAspectRatio === ratio.value ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'"
                  >
                    {{ ratio.label }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- 风格选择 -->
          <div>
            <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <SvgIcon icon="mdi:palette" class="text-pink-500" />
              风格
            </label>
            <NSelect
              v-model:value="selectedStyle"
              :options="styleOptions"
              placeholder="选择艺术风格（可选）"
              clearable
            />
          </div>

          <!-- 质量选择 -->
          <div>
            <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <SvgIcon icon="mdi:high-definition-box" class="text-green-500" />
              质量
            </label>
            <NSelect
              v-model:value="selectedQuality"
              :options="qualityOptions"
              placeholder="选择图像质量（可选）"
              clearable
            />
          </div>

          <!-- 参考图片上传 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              参考图片（可选）
            </label>
            <input
              ref="fileRef"
              type="file"
              accept="image/*"
              multiple
              style="display: none"
              @change="(e) => {
                const files = (e.target as HTMLInputElement).files;
                if (files) {
                  Array.from(files).slice(0, 5 - uploadedImages.length).forEach(file => {
                    handleFileSelect(file);
                  });
                }
              }"
            />
            <NButton class="w-full" @click="fileRef?.click()">
              <template #icon>
                <SvgIcon icon="mdi:upload" />
              </template>
              上传参考图片
            </NButton>
            
            <!-- 已上传的图片预览 -->
            <div v-if="uploadedImages.length > 0" class="mt-3 grid grid-cols-3 gap-2">
              <div
                v-for="(img, index) in uploadedImages"
                :key="index"
                class="relative group"
              >
                <img
                  :src="img"
                  class="w-full h-20 object-cover rounded-lg"
                  alt="Reference"
                />
                <button
                  @click="removeUploadedImage(index)"
                  class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 bg-red-500 text-white rounded-full p-1 transition-opacity"
                >
                  <SvgIcon icon="mdi:close" class="text-sm" />
                </button>
              </div>
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="flex gap-3 pt-2">
            <NButton
              type="primary"
              size="large"
              class="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 shadow-lg"
              :loading="loading"
              @click="generateImage"
            >
              <template #icon>
                <SvgIcon icon="mdi:auto-fix" />
              </template>
              {{ loading ? '生成中...' : '生成图像' }}
            </NButton>
            <NButton
              size="large"
              secondary
              @click="clearInput"
            >
              <template #icon>
                <SvgIcon icon="mdi:refresh" />
              </template>
              清空
            </NButton>
          </div>
        </div>
      </div>

      <!-- 右侧：图片画廊 -->
      <div class="flex-1 overflow-y-auto p-6">
        <div v-if="generatedImages.length === 0" class="h-full flex items-center justify-center">
          <div class="text-center max-w-md">
            <div class="mb-6">
              <SvgIcon icon="mdi:image-outline" class="text-8xl text-gray-300 dark:text-gray-600 mb-4 opacity-50" />
            </div>
            <h3 class="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">还没有生成的图像</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">输入提示词并点击生成按钮开始创作</p>
            <div class="flex flex-col gap-2 text-xs text-gray-400 dark:text-gray-500">
              <p>✨ 描述你想要的图像</p>
              <p>🎨 选择风格和宽高比</p>
              <p>🚀 点击生成，等待奇迹</p>
            </div>
          </div>
        </div>

        <div v-else>
          <div class="mb-4 flex items-center justify-between">
            <h2 class="text-lg font-semibold text-gray-700 dark:text-gray-300">
              生成的图像 ({{ generatedImages.length }})
            </h2>
          </div>
          <NGrid :cols="isMobile ? 1 : 3" :x-gap="20" :y-gap="20">
            <NGridItem
              v-for="image in generatedImages"
              :key="image.id"
            >
              <NCard class="image-card cursor-pointer hover:shadow-xl transition-all duration-300 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800">
                <div @click="viewImage(image.url)" class="relative group">
                  <div v-if="image.loading" class="absolute inset-0 bg-gray-900/50 flex items-center justify-center z-10 rounded-lg">
                    <NSpin size="large" />
                  </div>
                  <img
                    v-if="image.url"
                    :src="image.url"
                    class="w-full h-auto rounded-t-lg transition-transform duration-300 group-hover:scale-105"
                    :alt="image.prompt"
                    @error="image.url = ''"
                  />
                  <div v-else class="w-full aspect-square bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 rounded-t-lg flex items-center justify-center">
                    <NSpin size="large" />
                  </div>
                  <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-end justify-center pb-4">
                    <SvgIcon icon="mdi:eye" class="text-white text-2xl" />
                  </div>
                </div>
                <div class="p-4">
                  <p class="text-sm text-gray-700 dark:text-gray-300 line-clamp-2 mb-3 min-h-[2.5rem]">{{ image.prompt || '无提示词' }}</p>
                  <div class="flex gap-2">
                    <NButton 
                      size="small" 
                      quaternary 
                      class="flex-1"
                      @click.stop="downloadImage(image.url)"
                    >
                      <template #icon>
                        <SvgIcon icon="mdi:download" />
                      </template>
                      下载
                    </NButton>
                    <NButton 
                      size="small" 
                      quaternary 
                      class="flex-1"
                      @click.stop="() => {
                        if (image.url) {
                          navigator.clipboard.writeText(image.url);
                          message.success('链接已复制到剪贴板');
                        }
                      }"
                    >
                      <template #icon>
                        <SvgIcon icon="mdi:share" />
                      </template>
                      分享
                    </NButton>
                  </div>
                </div>
              </NCard>
            </NGridItem>
          </NGrid>
        </div>
      </div>
    </div>

    <!-- 图片预览模态框 -->
    <NModal v-model:show="showImageModal" preset="card" title="图片预览" style="max-width: 90vw;">
      <NImage
        :src="selectedImage"
        class="w-full"
        :preview-disabled="false"
      />
    </NModal>
  </div>
</template>

<style scoped>
.create-miracles-container {
  min-height: 100vh;
}

.aspect-ratio-item {
  transition: all 0.2s ease;
}

.image-card {
  overflow: hidden;
}

.image-card img {
  transition: transform 0.3s ease;
}

.image-card:hover img {
  transform: scale(1.05);
}
</style>

