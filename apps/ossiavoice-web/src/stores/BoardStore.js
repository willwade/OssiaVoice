import { ref } from 'vue'
import { defineStore } from 'pinia'

const STORAGE_NAME = 'aacBoardName'
const DB_NAME = 'ossiaBoards'
const STORE_NAME = 'trees'
const KEY = 'active'

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function getFromDb() {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const req = store.get(KEY)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  })
}

async function setInDb(value) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const req = store.put(value, KEY)
    req.onsuccess = () => resolve(true)
    req.onerror = () => reject(req.error)
  })
}

async function clearDb() {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const req = store.delete(KEY)
    req.onsuccess = () => resolve(true)
    req.onerror = () => reject(req.error)
  })
}

export const useBoardStore = defineStore('board', () => {
  const tree = ref(null)
  const name = ref(localStorage.getItem(STORAGE_NAME) || '')

  async function loadTree() {
    tree.value = await getFromDb()
    return tree.value
  }

  async function setTree(newTree, fileName = '') {
    tree.value = newTree
    name.value = fileName || ''
    localStorage.setItem(STORAGE_NAME, name.value)
    await setInDb(newTree)
  }

  async function clearTree() {
    tree.value = null
    name.value = ''
    localStorage.removeItem(STORAGE_NAME)
    await clearDb()
  }

  return {
    tree,
    name,
    loadTree,
    setTree,
    clearTree
  }
})
