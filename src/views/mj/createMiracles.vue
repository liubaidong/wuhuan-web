<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { NButton, NCard, NInput, NSelect, NImage, NGrid, NGridItem, useMessage, NModal, NSpin } from 'naive-ui'
import { SvgIcon } from '@/components/common'
import { useBasicLayout } from '@/hooks/useBasicLayout'
// import { t } from '@/locales' // 暂时未使用
import { upImg, mjFetch, mlog, getMjAll, localGet, url2base64, mjImgUrl } from '@/api'
import { homeStore, useChatStore } from '@/store'
import { imageModelList } from '@/api/model'
import { mjStore, type MjImage } from '@/api/mjStore'

const { isMobile } = useBasicLayout()
const message = useMessage()
const chatStore = useChatStore()
const mjS = new mjStore()

// 状态管理
const prompt = ref('')
const loading = ref(false)
const selectedAspectRatio = ref('16:9')
const selectedStyle = ref('')
const selectedQuality = ref('')
const selectedModel = ref('')
const modelOptions = ref<any[]>([])
const uploadedImages = ref<string[]>([])
const generatedImages = ref<any[]>([])
const showImageModal = ref(false)
const selectedImage = ref('')

// 从存储和聊天记录加载已生成的图片 - 参照视频功能
const loadGeneratedImages = async () => {
  try {
    mlog('开始加载图片列表...')
    
    // 首先从本地存储加载历史图片
    const storedImages = mjS.getObjs()
    mlog('从存储加载的图片:', storedImages.length)
    
    // 同时从聊天记录加载（作为补充）
    const d = await getMjAll(chatStore.$state)
    mlog('getMjAll 返回数据:', d?.length, d)
    
    // 合并存储的图片和聊天记录中的图片
    const allImagesMap = new Map<string, any>()
    
    // 先添加存储的图片
    storedImages.forEach((img: MjImage) => {
      if (img.id) {
        allImagesMap.set(img.id, {
          ...img,
          fromStorage: true,
        })
      }
    })
    
    // 再添加聊天记录中的图片（如果不存在或需要更新）
    if (d && d.length > 0) {
      const rz = d.filter((v: any) => v.mjID && v.opt).map((v: any) => {
        const imageId = v.mjID || v.myid || Date.now()
        return {
          mjID: v.mjID,
          id: imageId,
          src: v.opt.imageUrl || '',
          url: '', // 先设为空，等待加载 base64
          prompt: v.opt.promptEn || v.text || v.requestOptions?.prompt || v.opt.prompt || '',
          createdAt: v.dateTime || v.opt.startTime || new Date().toISOString(),
          taskId: v.mjID,
          loading: !v.opt.imageUrl, // 如果没有图片URL，显示加载状态
          image_url: v.opt.imageUrl || '',
          action: v.opt.action,
          time: v.opt.startTime || (v.dateTime ? new Date(v.dateTime).getTime() : Date.now()),
          status: v.opt.status,
          progress: v.opt.progress,
        }
      })

      // 将聊天记录中的图片添加到 Map（如果不存在或需要更新）
      for (const v of rz) {
        if (!v.mjID) continue
        const existing = allImagesMap.get(v.id)
        // 如果存储中没有，或者聊天记录中的图片更新（有URL而存储中没有）
        if (!existing || (!existing.image_url && v.image_url)) {
          allImagesMap.set(v.id, v)
        }
      }
    }

    // 处理所有图片，加载 base64 缓存
    const images: any[] = []
    for (const [id, v] of allImagesMap) {
      if (!v || (!v.mjID && !v.id)) continue
      
      const mjId = v.mjID || v.id || id
      if (!mjId) continue
      
      const key = 'img:' + mjId
      
      try {
        // 如果有图片 URL
        if (v.image_url || v.url) {
          const imageUrl = v.image_url || v.url
          let base64 = await localGet(key)
          if (base64) {
            v.url = base64
            v.image_url = base64
            v.loading = false
          } else if (imageUrl) {
            // 如果没有缓存，使用原始 URL，并异步加载 base64
            v.url = mjImgUrl(imageUrl)
            v.image_url = imageUrl
            v.loading = false
            // 异步加载并缓存
            url2base64(mjImgUrl(imageUrl), key).then((result: any) => {
              mlog('图片已保存>>', key)
              // 更新对应图片的 URL
              const image = generatedImages.value.find(img => (img.mjID || img.id) === mjId)
              if (image && result && result.base64) {
                image.url = result.base64
                image.image_url = result.base64
                // 更新存储
                try {
                  mjS.save({
                    id: image.id || mjId,
                    mjID: image.mjID || mjId,
                    url: result.base64,
                    image_url: result.base64,
                    prompt: image.prompt || '',
                    createdAt: image.createdAt || new Date().toISOString(),
                    taskId: image.taskId || image.mjID || mjId,
                    loading: false,
                    status: image.status,
                    progress: image.progress,
                    time: image.time || Date.now(),
                  })
                } catch (e) {
                  mlog('更新存储失败', e)
                }
              }
            }).catch((error) => {
              mlog('图片加载失败', error)
            })
          } else {
            // 如果还没有图片 URL，显示加载状态
            v.url = ''
            v.image_url = ''
            v.loading = true
          }
        } else {
          // 如果还没有图片 URL，显示加载状态
          v.url = ''
          v.image_url = ''
          v.loading = true
        }
        images.push(v)
      } catch (e) {
        mlog('加载图片失败', e)
        // 即使加载失败也显示原始 URL（如果有）
        if (v.image_url) {
          v.url = mjImgUrl(v.image_url)
        }
        v.loading = false
        images.push(v)
      }
    }

    // 按时间排序，最新的在前
    generatedImages.value = images.sort((a: any, b: any) => (b.time || 0) - (a.time || 0))
    
    // 保存所有图片到存储（确保持久化）
    generatedImages.value.forEach((img: any) => {
      if (img.id) {
        try {
          mjS.save({
            id: img.id,
            mjID: img.mjID || img.id,
            url: img.url || img.image_url || '',
            image_url: img.image_url || img.url || '',
            prompt: img.prompt || '',
            createdAt: img.createdAt || new Date().toISOString(),
            taskId: img.taskId || img.mjID || img.id,
            loading: img.loading || false,
            status: img.status,
            progress: img.progress,
            time: img.time || Date.now(),
          })
        } catch (e) {
          mlog('保存图片到存储失败', e)
        }
      }
    })
    
    mlog('图片列表加载完成，共', generatedImages.value.length, '张图片')
    mlog('图片列表详情:', generatedImages.value.map(img => ({ mjID: img.mjID, url: img.url ? '有URL' : '无URL', loading: img.loading })))
  } catch (error) {
    mlog('loadGeneratedImages error:', error)
    generatedImages.value = []
  }
}

// 监听聊天更新，更新图片状态 - 参照普通模式
watch(
  () => homeStore.myData.act,
  async (act, oldAct) => {
    mlog('createMiracles watch act:', act)
    if (act === 'updateChat') {
      // 当聊天更新时，检查是否有新的图片或进度更新
      const actData: any = homeStore.myData.actData
      if (actData && actData.mjID) {
        mlog('检测到图片更新', actData.mjID, actData.opt?.imageUrl, actData.opt?.progress)
        
        // 如果有图片URL，立即保存到存储
        if (actData.opt?.imageUrl) {
          const imageId = actData.mjID
          try {
            mjS.save({
              id: imageId,
              mjID: imageId,
              url: actData.opt.imageUrl,
              image_url: actData.opt.imageUrl,
              prompt: actData.text || actData.requestOptions?.prompt || '',
              createdAt: actData.dateTime || new Date().toISOString(),
              taskId: imageId,
              loading: false,
              status: actData.opt.status,
              progress: actData.opt.progress,
              time: actData.opt.startTime || Date.now(),
            })
          } catch (e) {
            mlog('保存图片到存储失败', e)
          }
        }
        
        // 延迟加载，确保数据已更新
        setTimeout(() => {
          loadGeneratedImages()
        }, 300)
      }
    } else if (act === 'mjReload') {
      // 当图片重新加载时
      mlog('mjReload 触发，重新加载图片')
      setTimeout(() => {
        loadGeneratedImages()
      }, 300)
    } else if (act === 'draw') {
      // 当提交新任务时，立即添加占位项，然后等待更新
      mlog('draw 触发，重新加载图片')
      setTimeout(() => {
        loadGeneratedImages()
      }, 500)
    }
  },
  { deep: true }
)

// 额外监听 chatStore 的变化，确保图片能及时更新
watch(
  () => chatStore.chat,
  () => {
    // 当聊天记录变化时，重新加载图片（使用防抖，避免频繁更新）
    clearTimeout((window as any).__createMiraclesLoadTimer)
    ;(window as any).__createMiraclesLoadTimer = setTimeout(() => {
      loadGeneratedImages()
    }, 800)
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
  
  // 立即创建一个临时占位卡片，让用户立即看到
  const tempId = `temp-${Date.now()}`
  const tempImage: any = {
    id: tempId,
    mjID: tempId,
    url: '',
    prompt: prompt.value,
    createdAt: new Date().toISOString(),
    taskId: tempId,
    loading: true,
    image_url: '',
    time: Date.now(),
  }
  generatedImages.value.unshift(tempImage)
  
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
      model: selectedModel.value || '', // 将选中的模型传到后台
    }

    // 调用后端API - 使用现有的 imagine 接口
    const response = await mjFetch('/mj/submit/imagine', params)

    // 处理 Gemini 模型返回格式（code: 200, msg 包含 JSON 字符串）
    if (response && response.code === 200 && response.msg) {
      try {
        // 解析 msg 字段中的 JSON 字符串
        const msgData = typeof response.msg === 'string' ? JSON.parse(response.msg) : response.msg
        
        // 提取图片 URL（Gemini 格式：candidates[0].content.parts[0].inlineData.data）
        let imageUrl = ''
        if (msgData.candidates && msgData.candidates.length > 0) {
          const candidate = msgData.candidates[0]
          if (candidate.content?.parts && candidate.content.parts.length > 0) {
            const part = candidate.content.parts[0]
            if (part.inlineData?.data) {
              imageUrl = part.inlineData.data
            }
          }
        }

        if (imageUrl) {
          // 如果直接返回了图片URL，更新临时卡片
          const imageId = `gemini-${Date.now()}`
          const tempIndex = generatedImages.value.findIndex(img => img.id === tempId)
          if (tempIndex !== -1) {
            // 更新临时卡片
            generatedImages.value[tempIndex] = {
              id: imageId,
              mjID: imageId,
              url: imageUrl, // 直接使用返回的URL
              prompt: prompt.value,
              createdAt: new Date().toISOString(),
              taskId: imageId,
              loading: false,
              image_url: imageUrl,
              time: Date.now(),
              status: 'SUCCESS',
            }
          } else {
            // 如果找不到临时卡片，创建新卡片
            generatedImages.value.unshift({
              id: imageId,
              mjID: imageId,
              url: imageUrl,
              prompt: prompt.value,
              createdAt: new Date().toISOString(),
              taskId: imageId,
              loading: false,
              image_url: imageUrl,
              time: Date.now(),
              status: 'SUCCESS',
            })
          }
          
          // 保存到存储
          mjS.save({
            id: imageId,
            mjID: imageId,
            url: imageUrl,
            image_url: imageUrl,
            prompt: prompt.value,
            createdAt: new Date().toISOString(),
            taskId: imageId,
            loading: false,
            status: 'SUCCESS',
            time: Date.now(),
          })
          
          message.success('图片生成成功！')
          
          // 异步缓存图片
          const key = 'img:' + imageId
          url2base64(imageUrl, key).then((result: any) => {
            mlog('图片已缓存>>', key)
            const image = generatedImages.value.find(img => img.id === imageId)
            if (image && result && result.base64) {
              image.url = result.base64
              image.image_url = result.base64
              // 更新存储
              mjS.save({
                id: imageId,
                mjID: imageId,
                url: result.base64,
                image_url: result.base64,
                prompt: prompt.value,
                createdAt: new Date().toISOString(),
                taskId: imageId,
                loading: false,
                status: 'SUCCESS',
                time: Date.now(),
              })
            }
          }).catch((error) => {
            mlog('图片缓存失败', error)
          })
        } else {
          // 如果没有找到图片URL，移除临时卡片
          const tempIndex = generatedImages.value.findIndex(img => img.id === tempId)
          if (tempIndex !== -1) {
            generatedImages.value.splice(tempIndex, 1)
          }
          message.warning('未找到图片URL')
        }
      } catch (parseError) {
        mlog('解析响应数据失败:', parseError)
        message.error('解析响应数据失败')
        // 移除临时卡片
        const tempIndex = generatedImages.value.findIndex(img => img.id === tempId)
        if (tempIndex !== -1) {
          generatedImages.value.splice(tempIndex, 1)
        }
      }
    } else if (response && response.result) {
      // 处理 Midjourney 格式（返回 taskId，需要等待）
      const taskId = response.result
      const tempIndex = generatedImages.value.findIndex(img => img.id === tempId)
      if (tempIndex !== -1) {
        // 更新临时卡片为真实的taskId
        generatedImages.value[tempIndex] = {
          id: taskId,
          mjID: taskId,
          url: '', // 等待生成完成后更新
          prompt: prompt.value,
          createdAt: new Date().toISOString(),
          taskId: taskId,
          loading: true,
          image_url: '',
          time: Date.now(),
        }
      } else {
        // 如果找不到临时卡片，创建新卡片
        generatedImages.value.unshift({
          id: taskId,
          mjID: taskId,
          url: '',
          prompt: prompt.value,
          createdAt: new Date().toISOString(),
          taskId: taskId,
          loading: true,
          image_url: '',
          time: Date.now(),
        })
      }
      
      // 保存到存储（即使还在生成中）
      mjS.save({
        id: taskId,
        mjID: taskId,
        url: '',
        image_url: '',
        prompt: prompt.value,
        createdAt: new Date().toISOString(),
        taskId: taskId,
        loading: true,
        time: Date.now(),
      })
      
      message.success('图片生成任务已提交，请稍候...')

      // 使用现有的任务处理机制
      homeStore.setMyData({
        act: 'draw',
        actData: {
          taskId: taskId,
          prompt: prompt.value,
        }
      })
    } else if (response?.code === 21) {
      // 需要模态确认
      message.info('请确认生成参数')
      // 移除临时卡片
      const tempIndex = generatedImages.value.findIndex(img => img.id === tempId)
      if (tempIndex !== -1) {
        generatedImages.value.splice(tempIndex, 1)
      }
    } else {
      mlog('未知的响应格式:', response)
      message.warning('未知的响应格式，请查看控制台')
      // 移除临时卡片
      const tempIndex = generatedImages.value.findIndex(img => img.id === tempId)
      if (tempIndex !== -1) {
        generatedImages.value.splice(tempIndex, 1)
      }
    }
  } catch (error: any) {
    mlog('generateImage error:', error)
    message.error(error?.error || error?.message || '图片生成失败')
    // 发生错误时，移除临时卡片
    const tempIndex = generatedImages.value.findIndex(img => img.id === tempId)
    if (tempIndex !== -1) {
      generatedImages.value.splice(tempIndex, 1)
    }
  } finally {
    loading.value = false
    // 注意：生成成功后不清空提示词，保留描述信息供用户继续使用
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

// 复制链接到剪贴板
const copyImageUrl = (imageUrl: string) => {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(imageUrl)
      message.success('链接已复制到剪贴板')
    } else {
      // 降级方案：使用传统方法
      const textArea = document.createElement('textarea')
      textArea.value = imageUrl
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      message.success('链接已复制到剪贴板')
    }
  } catch (e) {
    message.error('复制失败')
  }
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

// 获取模型列表
const fetchModelList = async () => {
  try {
    const result = await imageModelList()
    if (result && result.data) {
      modelOptions.value = result.data.map((model: any) => ({
        label: model.modelDescribe || model.modelName || '',
        value: model.modelName || '',
      }))
      mlog('Model list loaded:', modelOptions.value)
    }
  } catch (error) {
    mlog('Failed to load model list:', error)
    message.error('获取模型列表失败')
  }
}

// 组件挂载时加载图片和模型列表
onMounted(() => {
  loadGeneratedImages()
  fetchModelList()
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

          <!-- 模型选择 -->
          <div>
            <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <SvgIcon icon="mdi:robot" class="text-blue-500" />
              模型
            </label>
            <NSelect
              v-model:value="selectedModel"
              :options="modelOptions"
              placeholder="选择模型（可选）"
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
              @click="generateImage"
            >
              <template #icon>
                <SvgIcon icon="mdi:auto-fix" />
              </template>
              生成图像
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
              <NCard class="image-card hover:shadow-xl transition-all duration-300 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800" :class="{ 'cursor-pointer': image.url && !image.loading }">
                <div @click="image.url && !image.loading ? viewImage(image.url) : null" class="relative group">
                  <!-- 图像容器：始终存在的方框 -->
                  <div class="w-full aspect-square border-2 border-gray-300 dark:border-gray-600 rounded-t-lg overflow-hidden bg-white dark:bg-gray-800 flex items-center justify-center relative">
                    <!-- 如果图像已加载，显示图像 -->
                    <img
                      v-if="image.url && !image.loading"
                      :src="image.url"
                      class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      :alt="image.prompt"
                      @error="() => { image.url = image.image_url || image.src || ''; image.loading = false; }"
                    />
                    <!-- 如果正在加载或没有图像，显示加载动画 -->
                    <div v-else class="w-full h-full flex flex-col items-center justify-center">
                      <NSpin size="large" />
                      <p class="mt-4 text-sm text-gray-500 dark:text-gray-400" v-if="image.progress">
                        {{ image.progress }}
                      </p>
                      <p class="mt-4 text-sm text-gray-500 dark:text-gray-400" v-else>
                        生成中...
                      </p>
                    </div>
                  </div>
                  <!-- 悬停时的查看图标遮罩（仅在图像加载完成时显示） -->
                  <div v-if="image.url && !image.loading" class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-end justify-center pb-4 pointer-events-none">
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
                      @click.stop="copyImageUrl(image.url)"
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

