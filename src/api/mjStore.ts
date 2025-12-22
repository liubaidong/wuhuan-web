import { ss } from '@/utils/storage'

export type MjImage = {
  id: string
  mjID?: string
  url: string
  image_url: string
  prompt: string
  createdAt: string
  taskId?: string
  loading?: boolean
  status?: string
  progress?: string
  time: number
}

export class mjStore {
  private localKey = 'mj-images-store'

  public save(obj: MjImage) {
    if (!obj.id) {
      console.error('mjStore.save: id is required')
      return this
    }
    try {
      let arr = this.getObjs()
      let i = arr.findIndex(v => v.id === obj.id)
      if (i > -1) arr[i] = obj
      else arr.push(obj)
      ss.set(this.localKey, arr)
    } catch (e) {
      console.error('mjStore.save error:', e)
    }
    return this
  }

  public findIndex(id: string) {
    return this.getObjs().findIndex(v => v.id === id)
  }

  public getObjs(): MjImage[] {
    const obj = ss.get(this.localKey) as undefined | MjImage[]
    if (!obj) return []
    return obj
  }

  public remove(id: string) {
    const arr = this.getObjs()
    const filtered = arr.filter(v => v.id !== id)
    ss.set(this.localKey, filtered)
    return this
  }

  public clear() {
    ss.set(this.localKey, [])
    return this
  }
}

