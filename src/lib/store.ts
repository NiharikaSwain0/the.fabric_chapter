import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from './firebase'

export type Product = {
  id: string
  name: string
  description: string
  categoryId: string
  price: number
  discountPrice?: number
  stock: number
  active: boolean
  colors?: string[]
  variants?: { name: string; stock: number }[]
  imageUrl?: string
  popularity?: number
}

export type Hamper = {
  id: string
  name: string
  description: string
  price: number
  stock: number
  active: boolean
  imageUrl?: string
  contents?: string[]
}

export type CartLine = {
  key: string
  kind: 'product' | 'hamper' | 'custom'
  itemId: string
  name: string
  unitPrice: number
  quantity: number
  color?: string
  variant?: string
  details?: Record<string, unknown>
  imageUrl?: string
  stock: number
}

export type Address = {
  fullName: string
  email: string
  phone: string
  house: string
  street: string
  area: string
  city: string
  state: string
  pinCode: string
}

const requireDb = () => {
  if (!db) throw new Error('Connect Firebase to enable store data.')
  return db
}

export async function getProducts(categoryId?: string): Promise<Product[]> {
  const database = requireDb()
  const constraints = categoryId
    ? [where('active', '==', true), where('categoryId', '==', categoryId)]
    : [where('active', '==', true)]
  const snapshot = await getDocs(query(collection(database, 'products'), ...constraints))
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }) as Product)
}

export async function getHampers(): Promise<Hamper[]> {
  const snapshot = await getDocs(
    query(collection(requireDb(), 'hampers'), where('active', '==', true)),
  )
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }) as Hamper)
}

export async function getSetting<T>(key: string): Promise<T | null> {
  const snapshot = await getDoc(doc(requireDb(), 'settings', key))
  return snapshot.exists() ? (snapshot.data() as T) : null
}

export async function revalidateCart(items: CartLine[]): Promise<{ items: CartLine[]; subtotal: number }> {
  const [products, hampers, builderSettings] = await Promise.all([
    getProducts(),
    getHampers(),
    getSetting<{
      packaging?: { id: string; name: string; price: number }[]
      greetingCards?: { id: string; name: string; price: number }[]
    }>('hamperBuilder'),
  ])
  const productById = new Map(products.map((item) => [item.id, item]))
  const hamperById = new Map(hampers.map((item) => [item.id, item]))
  const currentItems = items.map((line): CartLine => {
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      throw new Error(`Check the quantity for ${line.name}.`)
    }
    if (line.kind === 'product') {
      const product = productById.get(line.itemId)
      if (!product || product.stock < line.quantity) {
        throw new Error(`${line.name} is no longer available in that quantity.`)
      }
      if (line.color && !product.colors?.includes(line.color)) {
        throw new Error(`The selected colour for ${line.name} is no longer available.`)
      }
      return {
        ...line,
        name: product.name,
        unitPrice: product.discountPrice ?? product.price,
        stock: product.stock,
        imageUrl: product.imageUrl,
      }
    }
    if (line.kind === 'hamper') {
      const hamper = hamperById.get(line.itemId)
      if (!hamper || hamper.stock < line.quantity) {
        throw new Error(`${line.name} is no longer available in that quantity.`)
      }
      return {
        ...line,
        name: hamper.name,
        unitPrice: hamper.price,
        stock: hamper.stock,
        imageUrl: hamper.imageUrl,
      }
    }

    const details = line.details as {
      products?: { productId: string; quantity: number; color?: string | null }[]
      packaging?: { id: string } | null
      greetingCard?: { id: string } | null
    } | undefined
    if (!details?.products?.length) {
      throw new Error('A custom hamper needs at least one available item.')
    }
    let bundlePrice = 0
    let bundleStock = Number.MAX_SAFE_INTEGER
    const selectedProducts = details.products.map((selection) => {
      const product = productById.get(selection.productId)
      if (!product || !Number.isInteger(selection.quantity) || selection.quantity < 1 ||
        product.stock < selection.quantity * line.quantity) {
        throw new Error('A selected custom-hamper item is no longer available in that quantity.')
      }
      if (selection.color && !product.colors?.includes(selection.color)) {
        throw new Error(`The selected colour for ${product.name} is no longer available.`)
      }
      const price = product.discountPrice ?? product.price
      bundlePrice += price * selection.quantity
      bundleStock = Math.min(bundleStock, Math.floor(product.stock / selection.quantity))
      return { ...selection, name: product.name, unitPrice: price }
    })
    let packaging: { id: string; name: string; price: number } | null = null
    if (details.packaging) {
      packaging = builderSettings?.packaging?.find((option) => option.id === details.packaging?.id) ?? null
      if (!packaging) throw new Error('The chosen gift packaging is no longer available.')
      bundlePrice += packaging.price
    }
    let greetingCard: { id: string; name: string; price: number } | null = null
    if (details.greetingCard) {
      greetingCard = builderSettings?.greetingCards?.find((option) => option.id === details.greetingCard?.id) ?? null
      if (!greetingCard) throw new Error('The chosen greeting card is no longer available.')
      bundlePrice += greetingCard.price
    }
    return {
      ...line,
      name: 'Build Your Own Hamper',
      unitPrice: bundlePrice,
      stock: bundleStock,
      details: { ...details, products: selectedProducts, packaging, greetingCard },
    }
  })
  return {
    items: currentItems,
    subtotal: currentItems.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0),
  }
}

export async function getCustomerCart(uid: string): Promise<CartLine[] | null> {
  const snapshot = await getDoc(doc(requireDb(), 'carts', uid))
  return snapshot.exists() ? (snapshot.data().items as CartLine[]) : null
}

export async function setCustomerCart(uid: string, items: CartLine[]) {
  await setDoc(doc(requireDb(), 'carts', uid), { items, updatedAt: serverTimestamp() })
}

export async function getWishlist(uid: string): Promise<string[]> {
  const snapshot = await getDoc(doc(requireDb(), 'wishlists', uid))
  return snapshot.exists() ? (snapshot.data().productIds as string[]) : []
}

export async function setWishlist(uid: string, productIds: string[]) {
  await setDoc(doc(requireDb(), 'wishlists', uid), {
    productIds,
    updatedAt: serverTimestamp(),
  })
}

export async function isStoreAdmin(uid: string): Promise<boolean> {
  const snapshot = await getDoc(doc(requireDb(), 'admins', uid))
  return snapshot.exists()
}

export async function getAdminProducts(): Promise<Product[]> {
  const snapshot = await getDocs(collection(requireDb(), 'products'))
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }) as Product)
}

export async function getAdminHampers(): Promise<Hamper[]> {
  const snapshot = await getDocs(collection(requireDb(), 'hampers'))
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }) as Hamper)
}

export async function saveProduct(product: Omit<Product, 'id'>, id?: string) {
  const database = requireDb()
  if (id) {
    await setDoc(doc(database, 'products', id), { ...product, updatedAt: serverTimestamp() }, { merge: true })
    return id
  }
  const entry = await addDoc(collection(database, 'products'), {
    ...product,
    createdAt: serverTimestamp(),
  })
  return entry.id
}

export async function deleteProduct(id: string) {
  await deleteDoc(doc(requireDb(), 'products', id))
}

export async function saveHamper(hamper: Omit<Hamper, 'id'>, id?: string) {
  const database = requireDb()
  if (id) {
    await setDoc(doc(database, 'hampers', id), {
      ...hamper,
      updatedAt: serverTimestamp(),
    }, { merge: true })
    return id
  }
  const entry = await addDoc(collection(database, 'hampers'), {
    ...hamper,
    createdAt: serverTimestamp(),
  })
  return entry.id
}

export async function deleteHamper(id: string) {
  await deleteDoc(doc(requireDb(), 'hampers', id))
}

export function watchAdminOrders(
  onOrders: (orders: Record<string, unknown>[], fromCache: boolean) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(collection(requireDb(), 'orders'), { includeMetadataChanges: true }, (snapshot) => {
    onOrders(
      snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })),
      snapshot.metadata.fromCache,
    )
  }, onError)
}

export function watchAdminPaymentReferences(
  onReferences: (references: Record<string, string>) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(collection(requireDb(), 'paymentReferences'), (snapshot) => {
    onReferences(Object.fromEntries(snapshot.docs.map((entry) => [
      entry.id,
      String(entry.data().reference ?? ''),
    ])))
  }, onError)
}

export async function getOrder(orderId: string): Promise<number | null> {
  const snapshot = await getDoc(doc(requireDb(), 'orders', orderId))
  return snapshot.exists() ? (snapshot.data().total as number) : null
}

export async function updateOrder(id: string, values: Record<string, unknown>) {
  await updateDoc(doc(requireDb(), 'orders', id), {
    ...values,
    updatedAt: serverTimestamp(),
  })
}

export async function submitPaymentReference(orderId: string, userId: string, reference: string) {
  await setDoc(doc(requireDb(), 'paymentReferences', orderId), {
    orderId,
    userId,
    reference,
    status: 'submitted',
    createdAt: serverTimestamp(),
  })
}

export async function placeOrder(order: {
  userId: string
  items: CartLine[]
  address: Address
  gift?: Record<string, unknown>
  paymentMethod: 'COD' | 'UPI'
  subtotal: number
  shipping: number
  total: number
}) {
  const reference = doc(collection(requireDb(), 'orders'))
  await setDoc(reference, {
    ...order,
    orderId: reference.id,
    orderStatus: 'Order Placed',
    paymentStatus: order.paymentMethod === 'UPI' ? 'Verification Pending' : 'Pending',
    createdAt: serverTimestamp(),
  })
  return reference.id
}

export function watchCustomerOrders(
  uid: string,
  onOrders: (orders: Record<string, unknown>[]) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    query(collection(requireDb(), 'orders'), where('userId', '==', uid)),
    (snapshot) => onOrders(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))),
    onError,
  )
}
