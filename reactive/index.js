'use strict'

const isObject = val => val !== null && typeof val === 'object'
const convert = target => isObject(target) ? reactive(target) : target
const hasOwnProperty = Object.prototype.hasOwnProperty
const hasOwn = (target, key) => hasOwnProperty.call(target, key)

function reactive (target) {
  if (!isObject(target)) target

  const handler = {
    get (target, key, reciver) {
      // ***收集依赖
      console.log('get', key)
      track(target, key)
      const result = Reflect.get(target, key, reciver)
      // 判断result是不是对象，如果是的话重新调用reactive转换成响应式对象
      return convert(result)
    },
    set (target, key, value, reciver) {
      // 返回值定义，严格模式下set没有返回值会报类型错误
      let result = true
      // 新旧值对比
      const oldValue = Reflect.get(target, key, reciver)
      if (oldValue !== value) {
        result = Reflect.set(target, key, value, reciver)
        // ***触发更新
        trigger(target, key)
        console.log('set', key, value)
      }

      return result
    },
    deleteProperty (target, key) {
      const hasKey = hasOwn(target, key)
      const result = Reflect.deleteProperty(target, key)

      // 判断自身代理对象有没有相同的key
      if (hasKey && result) {
        // ***触发更新
        trigger(target, key)
        console.log('del', key)
      }

      return result
    } 
  }

  return new Proxy(target, handler)
}


let activeEffect = null
function effect (callback) {
  activeEffect = callback
  callback() // 访问响应式对象的属性，去收集依赖
  activeEffect = null
}

/**
 * targetMap中存放的是target对应depsMap的map对象
 * depsMap中存放的是响应式对象属性key对应effect的Set数组
 * targetMap:(target,depsMap) -> depsMap:(key, [effect...])
 */
let targetMap = new WeakMap()
function track (target, key) {
  if (!activeEffect) return
  let depsMap = targetMap.get(target)
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()))
  }

  let dep = depsMap.get(key)
  if (!dep) {
    depsMap.set(key, (dep = new Set()))
  }

  dep.add(activeEffect)
}

// 拿到对应的effect更新
function trigger (target, key) {
  const depsMap = targetMap.get(target)
  if (!depsMap) return
  const dep = depsMap.get(key)
  if (dep) {
    dep.forEach(effect => effect())
  }
}


function ref (raw) {
  // 判断是不是ref创建的响应式对象
  if (isObject(raw) && raw.__v_isRef) return

  // 判断是不是对象，是直接转reactive不是的话继续
  let value = convert(raw)
  const r = {
    __v_isRef: true,
    get value () {
      track(r, 'value')
      return value
    },
    set value (newValue) {
      if (newValue !== value) {
        // 修改值
        raw = newValue
        // 重新给value赋值
        value = convert(raw)
        trigger(r, 'value')
      }
    }
  }

  return r
}


// 将reactive对象转成ref
function toRefs (proxy) {
  const ret = proxy instanceof Array ? new Array(proxy.length) : {}

  for (var key in proxy) {
    ret[key] = toProxyRef(proxy, key)
  }
  return ret
}

function toProxyRef (proxy, key) {
  return {
    __v_isRef: true,
    get value () {
      return proxy[key]
    },
    set value (newValue) {
      proxy[key] = newValue
    }
  }
}

function computed (getter) {
  // 把数据通过ref进行缓存, effect监听数据变化
  const result = ref()
  effect(() => (result.value = getter()))
  return result
}