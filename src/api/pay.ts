import request from '@/utils/request/req';
export interface OrderReq {
	money:string; // 商品价格
	name:string; //商品名称
}

export interface VoucherVO {
	/**
	 * 主键
	 */
	id: string | number;

	/**
	 * 用户id
	 */
	userId: string | number;

	/**
	 * 兑换码
	 */
	code: string;

	/**
	 * 兑换金额
	 */
	amount: number;

	/**
	 * 兑换状态
	 */
	status: string;

	/**
	 * 兑换前余额
	 */
	balanceBefore: number;

	/**
	 * 兑换后余额
	 */
	balanceAfter: number;

	/**
	 * 备注
	 */
	remark: string;

  }

export function payUrl(params:OrderReq) {
	return request({
		url: '/pay/payUrl',
		method: 'post',
		data: params,
	})
}

export function getSPayUrl(params:OrderReq) {
	return request({
		url: '/pay/stripePay',
		method: 'post',
		data: params,
	})
}

export function getOrderInfo(orderNo:string) {
	return request({
		url: '/pay/orderInfo',
		method: 'post',
		data: {"orderNo":orderNo}
	  });
}

export function redeemKey(params:VoucherVO) {
	return request({
		url: '/system/voucher/redeem',
		method: 'post',
		data: params
	  });
}

export interface ConsumptionRecordParams {
	pageNum?: number
	pageSize?: number
	userId?: string | number
}

export interface ConsumptionRecord {
	id: string | number
	orderNo: string
	amount: number
	type: string
	status: string
	createTime: string
	description: string
}

/**
 * 获取消费记录列表
 */
export function getConsumptionRecords(params?: ConsumptionRecordParams) {
	return request({
		url: '/system/consumeOrder/list',
		method: 'get',
		params: params || { pageNum: 1, pageSize: 10 }
	})
}




