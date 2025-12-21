<script setup lang='ts'>
import { computed, ref, watch } from 'vue'
import { NModal, NDataTable, NPagination, NEmpty, NSpin, NButton } from 'naive-ui'
import { useMessage } from 'naive-ui'
import { useBasicLayout } from '@/hooks/useBasicLayout'
import { getConsumptionRecords } from '@/api/pay'
import type { ConsumptionRecord } from '@/api/pay'
import { getUserInfo } from '@/api/user'
import to from 'await-to-js'
import { parseTime } from '@/utils/ruoyi'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

interface Props {
  visible: boolean
}

interface Emit {
  (e: 'update:visible', visible: boolean): void
}


const props = defineProps<Props>()
const { isMobile } = useBasicLayout()
const emit = defineEmits<Emit>()

const show = computed({
  get() {
    return props.visible
  },
  set(visible: boolean) {
    emit('update:visible', visible)
  },
})

const message = useMessage()
const loading = ref(false)
const exportLoading = ref(false)
const records = ref<ConsumptionRecord[]>([])
const userId = ref<string | number | null>(null)
const pagination = ref({
  pageNum: 1,
  pageSize: 10,
  total: 0
})

// 获取当前用户ID
async function getCurrentUserId() {
  if (userId.value) {
    return userId.value
  }
  try {
    const [err, userInfo] = await to(getUserInfo())
    if (!err && userInfo?.data?.user?.userId) {
      userId.value = Number(userInfo.data.user.userId)
      return userId.value
    }
  } catch (error) {
    console.error('获取用户ID失败:', error)
  }
  return null
}

// 获取消费记录列表
async function fetchConsumptionRecords() {
  loading.value = true
  try {
    // 获取当前用户ID
    const currentUserId = await getCurrentUserId()
    if (!currentUserId) {
      message.error('获取用户信息失败，请重新登录')
      loading.value = false
      return
    }

    console.log('请求参数:', {
      pageNum: pagination.value.pageNum,
      pageSize: pagination.value.pageSize,
      userId: currentUserId
    })

    const response: any = await getConsumptionRecords({
      pageNum: pagination.value.pageNum,
      pageSize: pagination.value.pageSize,
      userId: currentUserId
    })

    console.log('消费记录响应数据:', response)

    if (response && response.code === 200) {
      records.value = response.rows || response.data?.rows || []
      pagination.value.total = response.total || response.data?.total || 0
      console.log('消费记录列表:', records.value)
      console.log('总数:', pagination.value.total)
      // 调试：查看第一条记录的时间字段
      if (records.value.length > 0) {
        console.log('第一条记录:', records.value[0])
        console.log('时间字段值:', records.value[0].createTime)
      }
    } else {
      const errorMsg = response?.msg || response?.message || '获取消费记录失败'
      console.error('获取消费记录失败:', errorMsg, response)
      message.error(errorMsg)
    }
  } catch (error: any) {
    console.error('获取消费记录异常:', error)
    message.error(error.message || error.msg || '获取消费记录失败')
  } finally {
    loading.value = false
  }
}

// 分页变化
function handlePageChange(page: number) {
  pagination.value.pageNum = page
  fetchConsumptionRecords()
}

function handlePageSizeChange(pageSize: number) {
  pagination.value.pageSize = pageSize
  pagination.value.pageNum = 1
  fetchConsumptionRecords()
}

// 格式化金额
function formatAmount(amount: number) {
  return `¥${amount.toFixed(2)}`
}

// 格式化时间
function formatTime(time: string | number | null | undefined) {
  if (!time) return '-'

  try {
    // 使用项目中的 parseTime 函数，支持多种时间格式
    const formatted = parseTime(time, '{y}-{m}-{d} {h}:{i}:{s}')
    return formatted || '-'
  } catch (error) {
    console.error('时间格式化失败:', time, error)
    // 如果 parseTime 失败，尝试直接格式化
    try {
      const date = new Date(time as string | number)
      if (isNaN(date.getTime())) {
        return String(time)
      }
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    } catch (e) {
      return String(time)
    }
  }
}


// 导出Excel功能
async function exportToExcel() {
  exportLoading.value = true
  try {
    // 获取当前用户ID
    const currentUserId = await getCurrentUserId()
    if (!currentUserId) {
      message.error('获取用户信息失败，请重新登录')
      exportLoading.value = false
      return
    }

    message.loading('正在导出数据，请稍候...', { duration: 0 })

    // 获取所有数据（使用一个很大的pageSize）
    const response: any = await getConsumptionRecords({
      pageNum: 1,
      pageSize: 10000, // 设置一个很大的值以获取所有数据
      userId: currentUserId
    })

    if (response && response.code === 200) {
      const allRecords = response.rows || response.data?.rows || []

      if (allRecords.length === 0) {
        message.destroyAll()
        message.warning('暂无数据可导出')
        exportLoading.value = false
        return
      }

      // 准备导出数据
      const exportData = allRecords.map((row: any) => {
        const timeValue = row.createTime || row.create_time || row.time || row.orderTime || row.order_time
        return {
          '订单号': row.orderNo || '-',
          '消费金额': row.amount ? `¥${Number(row.amount).toFixed(2)}` : '-',
          '消费类型': row.orderName || '-',
          '消费时间': timeValue ? formatTime(timeValue) : '-',
          '描述': row.remark || '-'
        }
      })

      // 创建工作簿
      const worksheet = XLSX.utils.json_to_sheet(exportData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, '消费记录')

      // 设置列宽
      const colWidths = [
        { wch: 20 }, // 订单号
        { wch: 15 }, // 消费金额
        { wch: 15 }, // 消费类型
        { wch: 20 }, // 消费时间
        { wch: 30 }  // 描述
      ]
      worksheet['!cols'] = colWidths

      // 生成Excel文件并下载
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
      const dataBlob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

      // 生成文件名（包含当前日期）
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const day = String(now.getDate()).padStart(2, '0')
      const hour = String(now.getHours()).padStart(2, '0')
      const minute = String(now.getMinutes()).padStart(2, '0')
      const dateStr = `${year}${month}${day}_${hour}${minute}`
      const fileName = `消费记录_${dateStr}.xlsx`

      saveAs(dataBlob, fileName)
      message.destroyAll()
      message.success(`导出成功！共导出 ${allRecords.length} 条记录`)
    } else {
      message.destroyAll()
      const errorMsg = response?.msg || response?.message || '导出失败'
      message.error(errorMsg)
    }
  } catch (error: any) {
    message.destroyAll()
    console.error('导出Excel失败:', error)
    message.error(error.message || error.msg || '导出失败')
  } finally {
    exportLoading.value = false
  }
}

// 监听弹窗显示，打开时加载数据
watch(show, (newValue) => {
  if (newValue) {
    fetchConsumptionRecords()
  }
})

const columns = [
  {
    title: '订单号',
    key: 'orderNo',
    width: 180
  },
  {
    title: '消费金额',
    key: 'amount',
    width: 120,
    render(row: ConsumptionRecord) {
      return formatAmount(row.amount)
    }
  },
  {
    title: '消费类型',
    key: 'orderName',
    width: 120,
  },
	{
    title: '消费时间',
    key: 'createTime',
    width: 180,
    render(row: any) {
      // 尝试多个可能的时间字段名
      const timeValue = row.createTime || row.create_time || row.time || row.orderTime || row.order_time
      return formatTime(timeValue)
    }
  },
  {
    title: '描述',
    key: 'remark',
    ellipsis: {
      tooltip: true
    }
  }
]
</script>

<template>
  <NModal
    v-model:show="show"
    :auto-focus="false"
    preset="card"
    style="max-width: 1200px; position: fixed; left: 50%; top: 5vh; transform: translate(-50%, 0%);"
    :class="[isMobile ? 'mobile-consumption-modal' : 'consumption-modal']"
  >
    <template #header>
      <div class="modal-header">
        <span>消费记录查询</span>
        <NButton
          type="primary"
          :loading="exportLoading"
          @click="exportToExcel"
          :disabled="pagination.total === 0"
        >
          {{ exportLoading ? '导出中...' : '导出Excel' }}
        </NButton>
      </div>
    </template>
    <NSpin :show="loading">
      <div class="consumption-container">
        <div v-if="records.length === 0 && !loading" class="empty-container">
          <NEmpty description="暂无消费记录" />
        </div>
        <NDataTable
          v-else
          :columns="columns"
          :data="records"
          :bordered="false"
          :single-line="false"
          striped
          :loading="loading"
        />

        <div v-if="pagination.total > 0" class="pagination-container">
          <NPagination
            v-model:page="pagination.pageNum"
            v-model:page-size="pagination.pageSize"
            :item-count="pagination.total"
            :page-sizes="[10, 20, 50, 100]"
            show-size-picker
            show-quick-jumper
            @update:page="handlePageChange"
            @update:page-size="handlePageSizeChange"
          />
        </div>
      </div>
    </NSpin>
  </NModal>
</template>

<style scoped lang="less">
.consumption-container {
  min-height: 400px;

  .empty-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 300px;
  }

  .pagination-container {
    display: flex;
    justify-content: flex-end;
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid var(--n-border-color);
  }
}

.mobile-consumption-modal {
  :deep(.n-card) {
    width: 95vw;
    max-width: 95vw;
  }

  :deep(.n-data-table) {
    font-size: 12px;
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;

  span {
    font-size: 18px;
    font-weight: 500;
  }
}
</style>

