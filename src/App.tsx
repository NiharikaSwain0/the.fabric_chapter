import brandLogo from '../logo/logo .jpeg'
import {
  createContext,
  FormEvent,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  Link,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Heart,
  Instagram,
  LockKeyhole,
  Menu,
  Minus,
  PackageCheck,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  User,
} from 'firebase/auth'
import { auth, firebaseConfigured } from './lib/firebase'
import {
  Address,
  CartLine,
  deleteHamper,
  getCustomerCart,
  getAdminHampers,
  getAdminProducts,
  getHampers,
  getProducts,
  getSetting,
  getOrder,
  getWishlist,
  Hamper,
  isStoreAdmin,
  placeOrder,
  Product,
  revalidateCart,
  saveHamper,
  saveProduct,
  deleteProduct,
  setCustomerCart,
  setWishlist,
  submitPaymentReference,
  updateOrder,
  watchAdminPaymentReferences,
  watchAdminOrders,
  watchCustomerOrders,
} from './lib/store'

type StoreContextValue = {
  user: User | null
  products: Product[]
  hampers: Hamper[]
  catalogLoading: boolean
  catalogError: string
  cart: CartLine[]
  setCart: (items: CartLine[]) => void
  wishlist: string[]
  toggleWishlist: (id: string) => void
  refreshCatalog: () => Promise<void>
}

const StoreContext = createContext<StoreContextValue | null>(null)
const useStore = () => {
  const value = useContext(StoreContext)
  if (!value) throw new Error('Store context is missing')
  return value
}

const money = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value)

const productPrice = (item: Product) => item.discountPrice ?? item.price

function mergeLines(...groups: CartLine[][]) {
  const merged = new Map<string, CartLine>()
  groups.flat().forEach((line) => {
    if (!line || typeof line.key !== 'string' || !Number.isFinite(line.stock) ||
      line.stock < 1 || !Number.isFinite(line.quantity) || line.quantity < 1) return
    const existing = merged.get(line.key)
    merged.set(line.key, {
      ...line,
      quantity: Math.min(line.stock, Math.floor((existing?.quantity ?? 0) + line.quantity)),
    })
  })
  return [...merged.values()]
}

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(Boolean(auth))
  const [cart, setCartState] = useState<CartLine[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('tfc-cart') ?? '[]') as CartLine[]
    } catch {
      return []
    }
  })
  const [wishlist, setWishlistState] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('tfc-wishlist') ?? '[]') as string[]
    } catch {
      return []
    }
  })
  const [products, setProducts] = useState<Product[]>([])
  const [hampers, setHampers] = useState<Hamper[]>([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState('')
  const [accountDataLoaded, setAccountDataLoaded] = useState(!firebaseConfigured)

  const refreshCatalog = async () => {
    if (!firebaseConfigured) {
      setProducts([])
      setHampers([])
      setCatalogError('Connect Firebase to load the live store catalog.')
      setCatalogLoading(false)
      return
    }
    setCatalogLoading(true)
    try {
      const [loadedProducts, loadedHampers] = await Promise.all([
        getProducts(),
        getHampers(),
      ])
      setProducts(loadedProducts)
      setHampers(loadedHampers)
      setCatalogError('')
    } catch (error) {
      setCatalogError(
        error instanceof Error ? error.message : 'The store catalog could not be loaded.',
      )
    } finally {
      setCatalogLoading(false)
    }
  }

  useEffect(() => {
    if (!auth) return
    return onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser)
      setAuthLoading(false)
      if (!nextUser) {
        setAccountDataLoaded(true)
        return
      }
      try {
        const [savedCart, savedWishlist] = await Promise.all([
          getCustomerCart(nextUser.uid),
          getWishlist(nextUser.uid),
        ])
        setCartState((current) => mergeLines(current, savedCart ?? []))
        setWishlistState((current) => [...new Set([...current, ...savedWishlist])])
      } catch {
        // The signed-in session still works if optional customer data is unavailable.
      } finally {
        setAccountDataLoaded(true)
      }
    }, () => setAuthLoading(false))
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setProducts([])
      setHampers([])
      setCatalogError('')
      setCatalogLoading(false)
      return
    }
    void refreshCatalog()
  }, [authLoading, user])

  useEffect(() => {
    localStorage.setItem('tfc-cart', JSON.stringify(cart))
    if (user && firebaseConfigured && accountDataLoaded) {
      void setCustomerCart(user.uid, cart).catch(() => undefined)
    }
  }, [cart, user, accountDataLoaded])

  useEffect(() => {
    localStorage.setItem('tfc-wishlist', JSON.stringify(wishlist))
    if (user && firebaseConfigured && accountDataLoaded) {
      void setWishlist(user.uid, wishlist).catch(() => undefined)
    }
  }, [wishlist, user, accountDataLoaded])

  const setCart = (items: CartLine[]) => setCartState(items)
  const toggleWishlist = (id: string) =>
    setWishlistState((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )

  const value = useMemo<StoreContextValue>(
    () => ({
      user,
      products,
      hampers,
      catalogLoading,
      catalogError,
      cart,
      setCart,
      wishlist,
      toggleWishlist,
      refreshCatalog,
    }),
    [user, products, hampers, catalogLoading, catalogError, cart, wishlist],
  )

  return (
    <StoreContext.Provider value={value}>
      <Routes>
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route path="/forgot-password" element={<AuthPage mode="reset" />} />
        <Route element={<AuthGate user={user} loading={authLoading} />}>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/shop" element={<CatalogPage />} />
            <Route path="/category/:category" element={<CatalogPage />} />
            <Route path="/hampers" element={<HampersPage />} />
            <Route path="/build-hamper" element={<HamperBuilder />} />
            <Route path="/product/:id" element={<ProductPage />} />
            <Route path="/bag" element={<CartPage />} />
            <Route path="/wishlist" element={<WishlistPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/payment/:id" element={<PaymentPage />} />
            <Route path="/order-confirmation/:id" element={<OrderConfirmationPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/about" element={<InfoPage type="about" />} />
            <Route path="/contact" element={<InfoPage type="contact" />} />
            <Route path="/faq" element={<InfoPage type="faq" />} />
            <Route path="/policies/:policy" element={<PolicyPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
    </StoreContext.Provider>
  )
}

function AuthGate({ user, loading }: { user: User | null; loading: boolean }) {
  const location = useLocation()
  if (loading) {
    return <section className="auth-section section"><div className="auth-card"><Eyebrow>ONE MOMENT</Eyebrow><h1>Opening your<br /><em>little corner.</em></h1><p>Checking your sign-in…</p></div></section>
  }
  if (!user) {
    const next = `${location.pathname}${location.search}${location.hash}`
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />
  }
  return <Outlet />
}

function Layout() {
  const { cart, user } = useStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState('')
  const navigate = useNavigate()
  const count = cart.reduce((total, line) => total + line.quantity, 0)

  const submitSearch = (event: FormEvent) => {
    event.preventDefault()
    navigate(`/shop?search=${encodeURIComponent(search.trim())}`)
    setSearchOpen(false)
    setSearch('')
  }

  return (
    <div className="site-shell">
      <div className="announcement">
        <span>Little Things. Lovely Chapters.</span>
        <span className="announcement-divider">✳</span>
        <span>Thoughtful gifts, made for your favourite people.</span>
      </div>
      <header className="site-header">
        <button
          className="icon-button mobile-menu-button"
          aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <Link className="brand-lockup" to="/" aria-label="The Fabric Chapter home">
          <img
            className="brand-logo-image"
            src={brandLogo}
            alt="The Fabric Chapter"
            onLoad={(event) => {
              event.currentTarget.parentElement?.classList.add('has-brand-logo')
            }}
            onError={(event) => {
              event.currentTarget.style.display = 'none'
            }}
          />
          <span className="brand-wordmark">
            <span>THE FABRIC CHAPTER</span>
            <small>Little Things. Lovely Chapters.</small>
          </span>
        </Link>
        <nav className={`main-nav ${menuOpen ? 'is-open' : ''}`} aria-label="Main navigation">
          <NavLink to="/" onClick={() => setMenuOpen(false)}>Home</NavLink>
          <NavLink to="/shop" onClick={() => setMenuOpen(false)}>Shop</NavLink>
          <NavLink to="/category/scrunchies" onClick={() => setMenuOpen(false)}>Scrunchies</NavLink>
          <NavLink to="/category/hair-clips" onClick={() => setMenuOpen(false)}>Hair Clips</NavLink>
          <NavLink to="/hampers" onClick={() => setMenuOpen(false)}>Gift Hampers</NavLink>
          <NavLink to="/about" onClick={() => setMenuOpen(false)}>Our Story</NavLink>
        </nav>
        <div className="header-actions">
          <button className="icon-button" aria-label="Search" onClick={() => setSearchOpen(!searchOpen)}>
            <Search size={19} strokeWidth={1.6} />
          </button>
          <Link className="icon-button" aria-label="Wishlist" to="/wishlist">
            <Heart size={19} strokeWidth={1.6} />
          </Link>
          <Link className="bag-link" aria-label={`Shopping bag, ${count} items`} to="/bag">
            <ShoppingBag size={19} strokeWidth={1.6} />
            <span>Bag</span>
            <b>{count}</b>
          </Link>
          <Link className="account-link" to={user ? '/account' : '/login'}>
            {user ? 'My account' : 'Login'}
          </Link>
        </div>
        {searchOpen && (
          <form className="search-popover" onSubmit={submitSearch}>
            <input
              autoFocus
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search the collection"
              aria-label="Search products"
            />
            <button className="icon-button" aria-label="Submit search"><ArrowRight size={18} /></button>
          </form>
        )}
      </header>
      <main><Outlet /></main>
      <Footer />
    </div>
  )
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div className="footer-brand">
          <span className="footer-wordmark">The Fabric Chapter</span>
          <p>Little things, thoughtfully chosen.<br />Lovely chapters, made together.</p>
          <span className="social-link"><Instagram size={16} /> Instagram profile coming soon</span>
        </div>
        <div className="footer-column">
          <h3>Explore</h3>
          <Link to="/shop">Shop all</Link>
          <Link to="/category/scrunchies">Scrunchies</Link>
          <Link to="/category/hair-clips">Hair clips</Link>
          <Link to="/hampers">Gift hampers</Link>
          <Link to="/build-hamper">Build a hamper</Link>
        </div>
        <div className="footer-column">
          <h3>Here to help</h3>
          <Link to="/contact">Contact us</Link>
          <Link to="/faq">FAQs</Link>
          <Link to="/policies/shipping">Shipping policy</Link>
          <Link to="/policies/returns">Returns & refunds</Link>
          <Link to="/policies/privacy">Privacy policy</Link>
        </div>
        <div className="footer-note">
          <span className="eyebrow">A LITTLE NOTE</span>
          <p>Made with care, wrapped with love, and sent to wherever your next lovely chapter begins.</p>
          <Link className="text-link" to="/about">A little about us <ArrowRight size={15} /></Link>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} The Fabric Chapter</span>
        <span>Thoughtfully made in India</span>
        <Link to="/admin" className="admin-footer-link">Store admin</Link>
      </div>
    </footer>
  )
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <span className="eyebrow">{children}</span>
}

function HomePage() {
  const { products, hampers, catalogLoading, catalogError } = useStore()
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <Eyebrow>FOR ALL THE LITTLE LOVELY THINGS</Eyebrow>
          <h1>Every little thing<br />has a <em>chapter.</em></h1>
          <p>Thoughtful hair accessories and feel-good gifts, made to make the everyday a little more lovely.</p>
          <div className="hero-actions">
            <Link className="button button-dark" to="/shop">Explore the collection <ArrowRight size={16} /></Link>
            <Link className="button button-outline" to="/hampers">Find a little something <ArrowDownRight size={16} /></Link>
          </div>
          <div className="hero-footnote"><span className="mini-spark">✳</span> Small details. Big feelings.</div>
        </div>
        <div className="hero-art">
          <img
            className="hero-brand-logo"
            src={brandLogo}
            alt="The Fabric Chapter logo with a sewing machine and flower"
          />
        </div>
        <div className="hero-vertical-note">THE FABRIC CHAPTER · 2026</div>
      </section>

      <section className="trust-strip">
        <span><Sparkles size={16} /> Thoughtfully curated</span>
        <span className="trust-dot">✳</span>
        <span>Made for gifting</span>
        <span className="trust-dot">✳</span>
        <span>Little things, lovely chapters</span>
      </section>

      <section className="section category-section">
        <div className="section-heading">
          <div><Eyebrow>THE GOOD THINGS</Eyebrow><h2>Find your little <em>lovely.</em></h2></div>
          <Link className="text-link" to="/shop">Shop everything <ArrowRight size={16} /></Link>
        </div>
        <div className="category-grid">
          <CategoryCard number="01" title="Scrunchies" subtitle="A soft little something." to="/category/scrunchies" tone="rose" />
          <CategoryCard number="02" title="Hair clips" subtitle="Your finishing touch." to="/category/hair-clips" tone="sage" />
          <CategoryCard number="03" title="Gift hampers" subtitle="A whole lot of happy." to="/hampers" tone="peach" />
        </div>
      </section>

      <section className="featured-section">
        <div className="featured-copy">
          <Eyebrow>FOR YOUR FAVOURITE PEOPLE</Eyebrow>
          <h2>A little box<br />full of <em>happiness.</em></h2>
          <p>For birthdays, just-because days, and every lovely chapter in between. Find a hamper that says a little more.</p>
          <Link className="button button-dark" to="/hampers">Discover gift hampers <ArrowRight size={16} /></Link>
          <div className="featured-index">A thoughtful gift, from you to them. <span>✳</span></div>
        </div>
        <div className="featured-art">
          <div className="featured-ring" />
          <div className="featured-hamper-box">
            <div className="hamper-tissue" />
            <div className="hamper-items"><i /><i /><i /><i /></div>
            <div className="hamper-band">A LITTLE HAPPINESS</div>
          </div>
          <span className="featured-stamp">MADE<br />TO GIVE<br /><b>✳</b></span>
          <span className="featured-caption">OPEN SOMETHING LOVELY</span>
        </div>
      </section>

      <section className="section product-section">
        <div className="section-heading">
          <div><Eyebrow>THE CHAPTERS EVERYONE LOVES</Eyebrow><h2>Little <em>favourites.</em></h2></div>
          <Link className="text-link" to="/shop">View the collection <ArrowRight size={16} /></Link>
        </div>
        <ProductShelf products={products.slice(0, 4)} loading={catalogLoading} error={catalogError} />
        {products.length > 0 && <div className="center-action"><Link className="button button-outline" to="/shop">Shop all the lovely things</Link></div>}
      </section>

      <section className="builder-banner">
        <div className="builder-banner-mark">✳</div>
        <div>
          <Eyebrow>MAKE IT YOURS</Eyebrow>
          <h2>Your favourites,<br /><em>all in one box.</em></h2>
          <p>Pick the little things they love. Add a note from the heart. We'll help you make it lovely.</p>
          <Link className="button button-light" to="/build-hamper">Build your own hamper <ArrowRight size={16} /></Link>
        </div>
        <div className="builder-banner-art" aria-hidden="true">
          <div className="builder-circle"><span>YOUR<br />LITTLE<br /><b>BOX</b></span></div>
          <i className="builder-flower">✳</i>
          <i className="builder-spark">✧</i>
        </div>
      </section>

      <section className="section story-strip">
        <div className="story-quote-mark">“</div>
        <blockquote>We believe the smallest things can make the biggest memories.</blockquote>
        <p>A little note from our chapter to yours.</p>
        <Link className="text-link" to="/about">Get to know us <ArrowRight size={16} /></Link>
      </section>

      <section className="newsletter-section">
        <span className="newsletter-spark">✳</span>
        <Eyebrow>LETTERS FROM OUR LITTLE CORNER</Eyebrow>
        <h2>A little lovely,<br /><em>in your inbox.</em></h2>
        <p>New chapters, thoughtful gifting ideas and occasional little surprises.</p>
        <form className="newsletter-form" onSubmit={(event) => event.preventDefault()}>
          <input type="email" placeholder="Your email address" aria-label="Your email address" disabled />
          <button type="submit" disabled>Coming soon <ArrowRight size={15} /></button>
        </form>
        <small>We’ll only send the good things.</small>
      </section>
      {hampers.length === 0 && <span className="sr-only">No hamper inventory is currently published.</span>}
    </>
  )
}

function CategoryCard({ number, title, subtitle, to, tone }: {
  number: string; title: string; subtitle: string; to: string; tone: string
}) {
  return (
    <Link className={`category-card category-${tone}`} to={to}>
      <div className="category-card-art">
        <span className="category-orbit orbit-one" />
        <span className="category-orbit orbit-two" />
        <span className="category-card-flower">✳</span>
        <span className="category-card-number">{number}</span>
        <span className="category-card-label">A FABRIC CHAPTER</span>
      </div>
      <div className="category-card-copy">
        <div><h3>{title}</h3><p>{subtitle}</p></div>
        <span className="round-arrow"><ArrowRight size={16} /></span>
      </div>
    </Link>
  )
}

function ProductShelf({ products, loading, error }: { products: Product[]; loading: boolean; error: string }) {
  if (loading) return <div className="catalog-message">Gathering the lovely things…</div>
  if (!products.length) {
    return (
      <div className="empty-collection">
        <span className="empty-spark">✳</span>
        <h3>{error ? 'The collection is getting ready.' : 'A new chapter is on its way.'}</h3>
        <p>{error || 'Our shop will show products here as soon as they are added to the live catalog.'}</p>
      </div>
    )
  }
  return <div className="product-grid">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div>
}

function ProductCard({ product }: { product: Product }) {
  const { wishlist, toggleWishlist } = useStore()
  const saved = wishlist.includes(product.id)
  return (
    <article className="product-card">
      <div className="product-image-wrap">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="product-image" />
        ) : (
          <div className={`product-art product-art-${product.categoryId}`}><span>✳</span></div>
        )}
        {product.discountPrice && product.discountPrice < product.price && <span className="product-tag">A LITTLE LESS</span>}
        <button className={`wishlist-button ${saved ? 'is-saved' : ''}`} aria-label={saved ? 'Remove from wishlist' : 'Add to wishlist'} onClick={() => toggleWishlist(product.id)}>
          <Heart size={17} fill={saved ? 'currentColor' : 'none'} />
        </button>
        {product.stock <= 0 && <span className="sold-out-tag">Currently away</span>}
      </div>
      <div className="product-info">
        <span className="product-category">{product.categoryId.replace('-', ' ')}</span>
        <Link to={`/product/${product.id}`}><h3>{product.name}</h3></Link>
        <div className="product-card-bottom">
          <span>{money(productPrice(product))}{product.discountPrice && product.discountPrice < product.price && <del>{money(product.price)}</del>}</span>
          <span className="stock-note">{product.stock > 0 ? 'Ready to find a home' : 'Sold out for now'}</span>
        </div>
      </div>
    </article>
  )
}

function CatalogPage() {
  const { products, catalogLoading, catalogError } = useStore()
  const { category } = useParams()
  const [params, setParams] = useSearchParams()
  const [maxPrice, setMaxPrice] = useState(params.get('max') ?? '')
  const search = (params.get('search') ?? '').toLowerCase()
  const sort = params.get('sort') ?? 'featured'
  const title = category === 'scrunchies' ? 'Scrunchies' : category === 'hair-clips' ? 'Hair clips' : 'Shop all'
  let visible = products.filter((product) => {
    const matchesCategory = !category || product.categoryId === category
    const matchesSearch = !search || `${product.name} ${product.description}`.toLowerCase().includes(search)
    const matchesPrice = !maxPrice || productPrice(product) <= Number(maxPrice)
    return matchesCategory && matchesSearch && matchesPrice
  })
  if (sort === 'price-low') visible = [...visible].sort((a, b) => productPrice(a) - productPrice(b))
  if (sort === 'price-high') visible = [...visible].sort((a, b) => productPrice(b) - productPrice(a))
  if (sort === 'popular') visible = [...visible].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))

  return (
    <PageIntro eyebrow="A LITTLE SOMETHING FOR EVERY DAY" title={title} subtitle="Thoughtful little favourites, made to come along for the lovely bits.">
      <div className="catalog-toolbar">
        <span>{visible.length} {visible.length === 1 ? 'lovely thing' : 'lovely things'}</span>
        <div className="catalog-filters">
          <label>Up to <span className="sr-only">Maximum price in rupees</span><input value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} inputMode="numeric" placeholder="Any price" /></label>
          <select aria-label="Sort products" value={sort} onChange={(event) => setParams((current) => { current.set('sort', event.target.value); return current })}>
            <option value="featured">Sort: featured</option>
            <option value="popular">Most loved</option>
            <option value="price-low">Price: low to high</option>
            <option value="price-high">Price: high to low</option>
          </select>
        </div>
      </div>
      <ProductShelf products={visible} loading={catalogLoading} error={catalogError} />
    </PageIntro>
  )
}

function PageIntro({ eyebrow, title, subtitle, children }: {
  eyebrow: string; title: string; subtitle: string; children: ReactNode
}) {
  return (
    <>
      <section className="page-intro">
        <Link className="back-link" to="/"><ArrowLeft size={15} /> Back to the beginning</Link>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1>{title}</h1>
        <p>{subtitle}</p>
        <span className="page-intro-flower">✳</span>
      </section>
      <section className="section page-content">{children}</section>
    </>
  )
}

function ProductPage() {
  const { id } = useParams()
  const { products, cart, setCart, wishlist, toggleWishlist } = useStore()
  const [color, setColor] = useState('')
  const [quantity, setQuantity] = useState(1)
  const navigate = useNavigate()
  const product = products.find((item) => item.id === id)
  if (!product) return <EmptyPage title="This chapter isn't here yet." detail="Products appear here when they are published by the store." />
  const addToCart = (buyNow = false) => {
    const key = `product:${product.id}:${color}`
    setCart(mergeLines(cart, [{
      key,
      kind: 'product',
      itemId: product.id,
      name: product.name,
      unitPrice: productPrice(product),
      quantity,
      color: color || undefined,
      imageUrl: product.imageUrl,
      stock: product.stock,
    }]))
    navigate(buyNow ? '/checkout' : '/bag')
  }
  return (
    <section className="product-detail section">
      <div className="product-detail-art">
        {product.imageUrl ? <img src={product.imageUrl} alt={product.name} /> : <div className="product-art product-art-large"><span>✳</span></div>}
      </div>
      <div className="product-detail-copy">
        <Link to="/shop" className="back-link"><ArrowLeft size={15} /> Back to the collection</Link>
        <Eyebrow>{product.categoryId.replace('-', ' ')}</Eyebrow>
        <h1>{product.name}</h1>
        <div className="detail-price">{money(productPrice(product))}{product.discountPrice && product.discountPrice < product.price && <del>{money(product.price)}</del>}</div>
        <p className="detail-description">{product.description}</p>
        {product.colors?.length ? <fieldset className="option-group"><legend>Choose a colour</legend><div className="option-list">{product.colors.map((item) => <button key={item} className={`choice-chip ${color === item ? 'selected' : ''}`} onClick={() => setColor(item)}>{item}</button>)}</div></fieldset> : null}
        <div className="detail-stock">{product.stock > 0 ? `${product.stock} available` : 'Currently out of stock'}</div>
        <div className="purchase-row">
          <div className="quantity-control"><button aria-label="Decrease quantity" onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus size={15} /></button><span>{quantity}</span><button aria-label="Increase quantity" onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}><Plus size={15} /></button></div>
          <button className="button button-dark" disabled={product.stock <= 0} onClick={() => addToCart()}><ShoppingBag size={16} /> Add to bag</button>
          <button className={`icon-button detail-wishlist ${wishlist.includes(product.id) ? 'is-saved' : ''}`} aria-label="Toggle wishlist" onClick={() => toggleWishlist(product.id)}><Heart size={19} /></button>
        </div>
        <button className="text-link buy-now" disabled={product.stock <= 0} onClick={() => addToCart(true)}>Buy this little lovely now <ArrowRight size={15} /></button>
        <div className="product-promise"><PackageCheck size={18} /><span>Availability and final order details are confirmed by the store before dispatch.</span></div>
      </div>
    </section>
  )
}

function HampersPage() {
  const { hampers, catalogLoading, catalogError } = useStore()
  return (
    <>
      <section className="hamper-hero">
        <div>
          <Link className="back-link" to="/"><ArrowLeft size={15} /> Back to the beginning</Link>
          <Eyebrow>GIFT HAMPERS</Eyebrow>
          <h1>A little box<br />full of <em>happiness.</em></h1>
          <p>Make someone's day extra special with a thoughtfully curated little something, wrapped up with love.</p>
          <div className="hero-actions"><a className="button button-dark" href="#ready-hampers">Find their hamper <ArrowDownRight size={16} /></a><Link className="button button-outline" to="/build-hamper">Make it their own <Sparkles size={16} /></Link></div>
          <span className="hamper-hero-note">FOR BIRTHDAYS, BESTIES & JUST-BECAUSE DAYS</span>
        </div>
        <div className="hamper-hero-art"><div className="hamper-art-circle" /><div className="hamper-art-box"><span>to you,<br />with love</span><i>✳</i></div><span className="hamper-art-stamp">A LITTLE<br />HAPPINESS</span><span className="hamper-art-spark">✧</span></div>
      </section>
      <section className="section hamper-collection" id="ready-hampers">
        <div className="section-heading"><div><Eyebrow>READY TO MAKE SOMEONE'S DAY</Eyebrow><h2>Hampers with <em>heart.</em></h2></div><span className="hamper-count">CURATED WITH CARE <span>✳</span></span></div>
        {catalogLoading ? <div className="catalog-message">Gathering the lovely things…</div> : hampers.length ? (
          <div className="hamper-grid">{hampers.map((hamper) => <HamperCard key={hamper.id} hamper={hamper} />)}</div>
        ) : <ProductShelf products={[]} loading={false} error={catalogError || 'No ready-made hampers are currently published.'} />}
      </section>
      <section className="build-cta"><span>✳</span><div><Eyebrow>CAN'T FIND QUITE THE RIGHT THING?</Eyebrow><h2>Make a hamper that's <em>so them.</em></h2><p>Choose the pieces, add a little note, and make a gift that's just right.</p></div><Link className="button button-light" to="/build-hamper">Build your own <ArrowRight size={16} /></Link></section>
    </>
  )
}

function HamperCard({ hamper }: { hamper: Hamper }) {
  const { cart, setCart } = useStore()
  const [added, setAdded] = useState(false)
  const add = () => {
    if (hamper.stock < 1) return
    const line: CartLine = {
      key: `hamper:${hamper.id}`,
      kind: 'hamper',
      itemId: hamper.id,
      name: hamper.name,
      unitPrice: hamper.price,
      quantity: 1,
      stock: hamper.stock,
      imageUrl: hamper.imageUrl,
    }
    setCart(mergeLines(cart, [line]))
    setAdded(true)
  }
  return (
    <article className="hamper-card">
      <div className="hamper-card-art">{hamper.imageUrl ? <img src={hamper.imageUrl} alt={hamper.name} /> : <div className="product-art product-art-hampers"><span>✳</span></div>}<span className="hamper-card-stamp">MADE<br />TO GIVE</span></div>
      <Eyebrow>THE THOUGHTFUL BOX</Eyebrow><h3>{hamper.name}</h3><p>{hamper.description}</p>
      {hamper.contents?.length ? <span className="hamper-contents">{hamper.contents.join(' · ')}</span> : null}
      <div className="hamper-card-bottom"><strong>{money(hamper.price)}</strong><button className="button button-dark" disabled={hamper.stock < 1} onClick={add}>{added ? 'Added to bag' : hamper.stock > 0 ? 'Add to bag' : 'Currently away'} <ArrowRight size={15} /></button></div>
    </article>
  )
}

type BuilderSettings = {
  packaging?: { id: string; name: string; price: number }[]
  greetingCards?: { id: string; name: string; price: number }[]
}

function HamperBuilder() {
  const { products, catalogLoading, cart, setCart } = useStore()
  const [settings, setSettings] = useState<BuilderSettings>({})
  const [selected, setSelected] = useState<Record<string, { quantity: number; color: string }>>({})
  const [packaging, setPackaging] = useState('')
  const [card, setCard] = useState('')
  const [message, setMessage] = useState('')
  const [sender, setSender] = useState('')
  const [notice, setNotice] = useState('')
  const navigate = useNavigate()
  useEffect(() => {
    void getSetting<BuilderSettings>('hamperBuilder').then((value) => setSettings(value ?? {})).catch(() => undefined)
  }, [])
  const availableProducts = products.filter((item) => item.stock > 0 && ['scrunchies', 'hair-clips'].includes(item.categoryId))
  const selectedProducts = availableProducts.filter((item) => selected[item.id]?.quantity)
  const productsTotal = selectedProducts.reduce((sum, item) => sum + productPrice(item) * selected[item.id].quantity, 0)
  const selectedPackaging = settings.packaging?.find((option) => option.id === packaging)
  const selectedCard = settings.greetingCards?.find((option) => option.id === card)
  const total = productsTotal + (selectedPackaging?.price ?? 0) + (selectedCard?.price ?? 0)
  const updateSelection = (product: Product, quantity: number, color?: string) => {
    setSelected((current) => {
      const next = { ...current }
      if (quantity <= 0) delete next[product.id]
      else next[product.id] = { quantity: Math.min(product.stock, quantity), color: color ?? current[product.id]?.color ?? '' }
      return next
    })
  }
  const addCustomHamper = () => {
    if (!selectedProducts.length) return setNotice('Choose at least one available item to make your hamper.')
    const details = {
      products: selectedProducts.map((item) => ({
        productId: item.id,
        name: item.name,
        quantity: selected[item.id].quantity,
        color: selected[item.id].color || null,
        unitPrice: productPrice(item),
      })),
      packaging: selectedPackaging ?? null,
      greetingCard: selectedCard ?? null,
      giftMessage: message.trim(),
      senderName: sender.trim(),
    }
    const line: CartLine = {
      key: `custom:${Date.now()}`,
      kind: 'custom',
      itemId: 'custom-hamper',
      name: 'Build Your Own Hamper',
      unitPrice: total,
      quantity: 1,
      stock: Math.min(...selectedProducts.map((item) => Math.floor(item.stock / selected[item.id].quantity))),
      details,
    }
    setCart([...cart, line])
    navigate('/bag')
  }
  return (
    <>
      <section className="builder-intro">
        <Link className="back-link" to="/hampers"><ArrowLeft size={15} /> Back to gift hampers</Link>
        <Eyebrow>THE GIFT, THE WAY YOU IMAGINED IT</Eyebrow>
        <h1>Your favourites,<br /><em>all in one box.</em></h1>
        <p>Choose the little things they love, add a note from the heart, and we'll help you make it lovely.</p>
        <span className="builder-intro-flower">✳</span>
      </section>
      <section className="builder-workspace section">
        <div className="builder-steps">
          <BuilderStep number="01" title="Pick their favourites">
            {catalogLoading ? <div className="catalog-message">Loading the live collection…</div> : availableProducts.length ? (
              <div className="builder-product-list">{availableProducts.map((product) => {
                const quantity = selected[product.id]?.quantity ?? 0
                return <div className="builder-product" key={product.id}>
                  <div className="builder-product-art"><span>✳</span></div>
                  <div className="builder-product-info"><span className="product-category">{product.categoryId.replace('-', ' ')}</span><strong>{product.name}</strong><span>{money(productPrice(product))}</span></div>
                  {product.colors?.length ? <select aria-label={`Colour for ${product.name}`} value={selected[product.id]?.color ?? ''} onChange={(event) => updateSelection(product, quantity, event.target.value)}><option value="">Colour</option>{product.colors.map((color) => <option key={color}>{color}</option>)}</select> : null}
                  <div className="quantity-control"><button aria-label={`Remove one ${product.name}`} onClick={() => updateSelection(product, quantity - 1)}><Minus size={14} /></button><span>{quantity}</span><button aria-label={`Add one ${product.name}`} disabled={quantity >= product.stock} onClick={() => updateSelection(product, quantity + 1)}><Plus size={14} /></button></div>
                </div>
              })}</div>
            ) : <div className="empty-collection compact"><h3>The collection is being prepared.</h3><p>Only live, in-stock scrunchies and hair clips can be added to a custom hamper.</p></div>}
          </BuilderStep>
          <BuilderStep number="02" title="Add a little note">
            <label className="field-label">Your name<input value={sender} onChange={(event) => setSender(event.target.value)} placeholder="From..." maxLength={60} /></label>
            <label className="field-label">A message for them<textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write something lovely..." maxLength={300} rows={4} /></label>
          </BuilderStep>
          <BuilderStep number="03" title="Make it gift-ready">
            {settings.packaging?.length ? <label className="field-label">Gift packaging<select value={packaging} onChange={(event) => setPackaging(event.target.value)}><option value="">Choose packaging</option>{settings.packaging.map((option) => <option value={option.id} key={option.id}>{option.name} · {money(option.price)}</option>)}</select></label> : <p className="muted-note">Gift packaging options will appear here when configured by the store.</p>}
            {settings.greetingCards?.length ? <label className="field-label">Greeting card<select value={card} onChange={(event) => setCard(event.target.value)}><option value="">No card</option>{settings.greetingCards.map((option) => <option value={option.id} key={option.id}>{option.name} · {money(option.price)}</option>)}</select></label> : null}
          </BuilderStep>
        </div>
        <aside className="builder-summary">
          <div className="summary-top"><Eyebrow>YOUR LITTLE BOX</Eyebrow><span className="summary-spark">✳</span></div>
          <h2>A box made<br /><em>just for them.</em></h2>
          {selectedProducts.length ? <ul className="summary-lines">{selectedProducts.map((item) => <li key={item.id}><span>{selected[item.id].quantity} × {item.name}{selected[item.id].color ? ` · ${selected[item.id].color}` : ''}</span><strong>{money(productPrice(item) * selected[item.id].quantity)}</strong></li>)}</ul> : <p className="summary-empty">Your lovely things will gather here as you choose them.</p>}
          {selectedPackaging && <div className="summary-line"><span>{selectedPackaging.name}</span><strong>{money(selectedPackaging.price)}</strong></div>}
          {selectedCard && <div className="summary-line"><span>{selectedCard.name}</span><strong>{money(selectedCard.price)}</strong></div>}
          <div className="summary-total"><span>Your little total</span><strong>{money(total)}</strong></div>
          <button className="button button-dark button-full" disabled={!selectedProducts.length} onClick={addCustomHamper}>Add hamper to bag <ArrowRight size={16} /></button>
          {notice && <p className="form-notice">{notice}</p>}
          <small>Final availability and totals are confirmed by the store before dispatch.</small>
        </aside>
      </section>
    </>
  )
}

function BuilderStep({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  return <section className="builder-step"><span className="step-number">{number}</span><div><h2>{title}</h2>{children}</div></section>
}

function CartPage() {
  const { cart, setCart } = useStore()
  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const updateQuantity = (line: CartLine, quantity: number) =>
    setCart(quantity <= 0 ? cart.filter((item) => item.key !== line.key) : cart.map((item) => item.key === line.key ? { ...item, quantity: Math.min(item.stock, quantity) } : item))
  return (
    <PageIntro eyebrow="THE LITTLE THINGS YOU PICKED" title="Your shopping bag" subtitle="A few lovely things, all in one place.">
      {cart.length ? <div className="cart-layout"><div className="cart-lines">{cart.map((line) => <article className="cart-line" key={line.key}>
        <div className="cart-line-art">{line.imageUrl ? <img src={line.imageUrl} alt="" /> : <span>✳</span>}</div>
        <div className="cart-line-detail"><Link to={line.kind === 'product' ? `/product/${line.itemId}` : line.kind === 'hamper' ? '/hampers' : '/build-hamper'}><h3>{line.name}</h3></Link>{line.color && <span>Colour: {line.color}</span>}{line.kind === 'custom' && <span>Custom hamper · personalisation saved</span>}<strong>{money(line.unitPrice)}</strong></div>
        <div className="quantity-control"><button aria-label="Decrease quantity" onClick={() => updateQuantity(line, line.quantity - 1)}><Minus size={14} /></button><span>{line.quantity}</span><button aria-label="Increase quantity" disabled={line.quantity >= line.stock} onClick={() => updateQuantity(line, line.quantity + 1)}><Plus size={14} /></button></div>
        <strong className="cart-line-total">{money(line.unitPrice * line.quantity)}</strong>
        <button className="icon-button remove-line" aria-label={`Remove ${line.name}`} onClick={() => updateQuantity(line, 0)}><Trash2 size={17} /></button>
      </article>)}</div><aside className="cart-summary"><Eyebrow>A LITTLE ORDER SUMMARY</Eyebrow><div className="summary-line"><span>Subtotal</span><strong>{money(subtotal)}</strong></div><div className="summary-line"><span>Shipping</span><span>Calculated by the store</span></div><div className="summary-total"><span>Estimated total</span><strong>{money(subtotal)}</strong></div><p className="muted-note">Final shipping, product availability and payable amount will be confirmed by the store before dispatch.</p><Link className="button button-dark button-full" to="/checkout">Continue to checkout <ArrowRight size={16} /></Link><Link className="continue-shopping" to="/shop"><ArrowLeft size={14} /> Continue shopping</Link></aside></div> : <EmptyPage title="Your bag is taking a little breather." detail="When you find something lovely, it will be waiting here." action={<Link className="button button-dark" to="/shop">Explore the collection <ArrowRight size={16} /></Link>} />}
    </PageIntro>
  )
}

function WishlistPage() {
  const { wishlist, products } = useStore()
  const saved = products.filter((product) => wishlist.includes(product.id))
  return <PageIntro eyebrow="SAVED FOR A LOVELY DAY" title="Your wishlist" subtitle="Keep the little things you love close by."><ProductShelf products={saved} loading={false} error={saved.length ? '' : 'Your wishlist is waiting for its first lovely thing.'} /></PageIntro>
}

function CheckoutPage() {
  const { user, cart, setCart } = useStore()
  const navigate = useNavigate()
  const [payment, setPayment] = useState<'COD' | 'UPI'>('COD')
  const [isGift, setIsGift] = useState(false)
  const [recipientName, setRecipientName] = useState('')
  const [recipientPhone, setRecipientPhone] = useState('')
  const [giftMessage, setGiftMessage] = useState('')
  const [shippingCharge, setShippingCharge] = useState<number | null>(null)
  const [address, setAddress] = useState<Address>({
    fullName: user?.displayName ?? '', email: user?.email ?? '', phone: '', house: '', street: '', area: '', city: '', state: '', pinCode: '',
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const estimatedTotal = subtotal + (shippingCharge ?? 0)
  const updateAddress = (key: keyof Address, value: string) => setAddress((current) => ({ ...current, [key]: value }))
  useEffect(() => {
    if (!user) return
    setAddress((current) => ({
      ...current,
      fullName: current.fullName || user.displayName || '',
      email: current.email || user.email || '',
    }))
  }, [user])
  useEffect(() => {
    void getSetting<{ shippingCharge: number }>('storefront')
      .then((setting) => {
        if (typeof setting?.shippingCharge === 'number' &&
          Number.isFinite(setting.shippingCharge) && setting.shippingCharge >= 0) {
          setShippingCharge(setting.shippingCharge)
        }
      })
      .catch(() => setShippingCharge(null))
  }, [])
  if (!user) return <EmptyPage title="A little sign-in first." detail="Please sign in to keep your order details together." action={<Link className="button button-dark" to="/login?next=/checkout">Sign in to continue <ArrowRight size={16} /></Link>} />
  if (!user.emailVerified) return <EmptyPage title="One little check before checkout." detail="Please verify your email address before placing an order." action={<EmailVerificationPrompt user={user} />} />
  if (!cart.length) return <EmptyPage title="Your bag is empty." detail="Find a little something lovely before checking out." action={<Link className="button button-dark" to="/shop">Explore the collection <ArrowRight size={16} /></Link>} />
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const phoneDigits = address.phone.replace(/\D/g, '')
    const pinDigits = address.pinCode.replace(/\D/g, '')
    const cleanAddress: Address = {
      fullName: address.fullName.trim(),
      email: address.email.trim(),
      phone: address.phone.trim(),
      house: address.house.trim(),
      street: address.street.trim(),
      area: address.area.trim(),
      city: address.city.trim(),
      state: address.state.trim(),
      pinCode: pinDigits,
    }
    const requiredAddressFields = [
      cleanAddress.fullName, cleanAddress.email, cleanAddress.phone,
      cleanAddress.house, cleanAddress.street, cleanAddress.area,
      cleanAddress.city, cleanAddress.state, cleanAddress.pinCode,
    ]
    const addressLimits = [
      [cleanAddress.fullName, 80], [cleanAddress.email, 254],
      [cleanAddress.phone, 20], [cleanAddress.house, 180],
      [cleanAddress.street, 180], [cleanAddress.area, 180],
      [cleanAddress.city, 100], [cleanAddress.state, 100],
    ] as const
    if (phoneDigits.length < 10 || phoneDigits.length > 13 || pinDigits.length !== 6 ||
      requiredAddressFields.some((value) => !value) ||
      addressLimits.some(([value, max]) => value.length > max) ||
      !/^[+]?[0-9][0-9 ()-]{8,18}$/.test(cleanAddress.phone)) {
      setError('Please check that your delivery details, phone number, email and six-digit PIN code are valid.')
      return
    }
    if (isGift && !recipientName.trim()) {
      setError("Please add the gift recipient's name.")
      return
    }
    const recipientDigits = recipientPhone.replace(/\D/g, '')
    if (isGift && (recipientDigits.length < 10 || recipientDigits.length > 13)) {
      setError("Please enter the recipient's valid contact number.")
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const validated = await revalidateCart(cart)
      if (validated.subtotal !== subtotal) {
        setCart(validated.items)
        setError('A product price changed. Please review your updated bag total and place the order again.')
        return
      }
      const id = await placeOrder({
        userId: user.uid,
        items: validated.items,
        address: cleanAddress,
        gift: isGift ? {
          recipientName: recipientName.trim(),
          recipientPhone: recipientDigits,
          senderName: address.fullName.trim(),
          giftMessage: giftMessage.trim(),
        } : undefined,
        paymentMethod: payment,
        subtotal: validated.subtotal,
        shipping: shippingCharge ?? 0,
        total: validated.subtotal + (shippingCharge ?? 0),
      })
      setCart([])
      navigate(payment === 'UPI' ? `/payment/${id}` : `/order-confirmation/${id}`)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'We could not place the order. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }
  return (
    <section className="checkout-section section">
      <div className="checkout-heading"><Link className="back-link" to="/bag"><ArrowLeft size={15} /> Back to your bag</Link><Eyebrow>THE LAST LITTLE STEP</Eyebrow><h1>Delivery & payment</h1><p>Your order will be reviewed by the store before it is confirmed.</p></div>
      <form className="checkout-layout" onSubmit={submit}>
        <div className="checkout-fields">
          <section className="checkout-card"><div className="checkout-section-title"><span>01</span><h2>Your details</h2></div><div className="form-grid">
            <TextField label="Your full name" value={address.fullName} onChange={(v) => updateAddress('fullName', v)} required />
            <TextField label="Email address" type="email" value={address.email} onChange={(v) => updateAddress('email', v)} required />
            <TextField label="Your mobile number" value={address.phone} onChange={(v) => updateAddress('phone', v)} required />
          </div></section>
          <section className="checkout-card"><div className="checkout-section-title"><span>02</span><h2>{isGift ? "Recipient's delivery address" : 'Where should we send it?'}</h2></div>{isGift && <p className="muted-note">Add the recipient's delivery address here. Your details above are used for order updates.</p>}<div className="form-grid">
            <TextField label="House / flat number" value={address.house} onChange={(v) => updateAddress('house', v)} required />
            <TextField label="Street" value={address.street} onChange={(v) => updateAddress('street', v)} required />
            <TextField label="Area / landmark" value={address.area} onChange={(v) => updateAddress('area', v)} required />
            <TextField label="City" value={address.city} onChange={(v) => updateAddress('city', v)} required />
            <TextField label="State" value={address.state} onChange={(v) => updateAddress('state', v)} required />
            <TextField label="PIN code" value={address.pinCode} onChange={(v) => updateAddress('pinCode', v)} required />
          </div><label className="check-row"><input type="checkbox" checked={isGift} onChange={(event) => setIsGift(event.target.checked)} /><span>This order is a gift</span></label>{isGift && <div className="gift-fields"><div className="form-grid"><TextField label="Recipient's name" value={recipientName} onChange={setRecipientName} required /><TextField label="Recipient's contact number" value={recipientPhone} onChange={setRecipientPhone} required /></div><label className="field-label">A little note for them<textarea rows={3} maxLength={300} value={giftMessage} onChange={(event) => setGiftMessage(event.target.value)} placeholder="Write a gift message..." /></label><p className="muted-note">Gift messages do not include product prices.</p></div>}</section>
          <section className="checkout-card"><div className="checkout-section-title"><span>03</span><h2>How would you like to pay?</h2></div><label className={`payment-choice ${payment === 'COD' ? 'selected' : ''}`}><input type="radio" checked={payment === 'COD'} onChange={() => setPayment('COD')} /><span><strong>Cash on delivery</strong><small>Pay when your parcel arrives.</small></span><span className="payment-indicator" /></label><label className={`payment-choice ${payment === 'UPI' ? 'selected' : ''} ${shippingCharge === null ? 'disabled' : ''}`}><input type="radio" checked={payment === 'UPI'} disabled={shippingCharge === null} onChange={() => setPayment('UPI')} /><span><strong>Manual UPI</strong><small>{shippingCharge === null ? 'Available when the store configures shipping charges.' : 'Payment will need to be verified by the store.'}</small></span><span className="payment-indicator" /></label><p className="muted-note">Online card payments are coming soon. We never ask for your UPI PIN or OTP.</p></section>
        </div>
        <aside className="checkout-summary"><Eyebrow>YOUR LITTLE ORDER</Eyebrow>{cart.map((line) => <div className="checkout-item" key={line.key}><span>{line.quantity} × {line.name}</span><strong>{money(line.unitPrice * line.quantity)}</strong></div>)}<div className="summary-line"><span>Subtotal</span><strong>{money(subtotal)}</strong></div><div className="summary-line"><span>Shipping</span>{shippingCharge === null ? <span>Confirmed by store</span> : <strong>{money(shippingCharge)}</strong>}</div><div className="summary-total"><span>{shippingCharge === null ? 'Estimated subtotal' : 'Estimated total'}</span><strong>{money(estimatedTotal)}</strong></div><p className="checkout-disclaimer"><LockKeyhole size={15} /> Payment is not processed on this website. The store confirms availability and final charges before dispatch.</p>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-dark button-full" type="submit" disabled={submitting}>{submitting ? 'Placing your request…' : 'Place order request'} <ArrowRight size={16} /></button></aside>
      </form>
    </section>
  )
}

function TextField({ label, value, onChange, required = false, type = 'text' }: {
  label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string
}) {
  return <label className="field-label">{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} /></label>
}

function EmailVerificationPrompt({ user }: { user: User }) {
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const refresh = async () => {
    setBusy(true)
    try {
      await user.reload()
      if (user.emailVerified) {
        await user.getIdToken(true)
        window.location.reload()
      }
      else setMessage('Your email is not verified yet. Open the verification link, then try again.')
    } catch {
      setMessage('We could not refresh your verification status. Please sign in again after verifying.')
    } finally {
      setBusy(false)
    }
  }
  const resend = async () => {
    setBusy(true)
    try {
      await sendEmailVerification(user)
      setMessage('A new verification email is on its way.')
    } catch {
      setMessage('We could not send a new link right now. Please try again shortly.')
    } finally {
      setBusy(false)
    }
  }
  return <div className="verification-prompt"><button className="button button-dark" disabled={busy} onClick={() => void refresh()}>{busy ? 'Checking…' : 'I have verified my email'}</button><button className="text-link" disabled={busy} onClick={() => void resend()}>Send a new verification link</button>{message && <p className="form-notice" role="status">{message}</p>}</div>
}

function PaymentPage() {
  const { id } = useParams()
  const { user } = useStore()
  const [upiId, setUpiId] = useState('')
  const [amount, setAmount] = useState<number | null>(null)
  const [reference, setReference] = useState('')
  const [notice, setNotice] = useState('')
  const [savingReference, setSavingReference] = useState(false)
  useEffect(() => {
    void Promise.all([getSetting<{ value: string }>('upiId'), getOrder(id ?? '')])
      .then(([setting, total]) => { setUpiId(setting?.value ?? ''); setAmount(total) })
      .catch(() => setNotice('The store payment instructions are not configured yet. Please contact the store before paying.'))
  }, [id])
  const paymentUri = upiId && amount !== null ? `upi://pay?pa=${encodeURIComponent(upiId)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Order ${id}`)}` : ''
  const saveReference = async () => {
    if (!user || !id || reference.trim().length < 6) {
      setNotice('Enter a transaction reference with at least 6 characters.')
      return
    }
    setSavingReference(true)
    try {
      await submitPaymentReference(id, user.uid, reference.trim())
      setNotice('Reference received. Payment verification is still pending with the store.')
      setReference('')
    } catch {
      setNotice('We could not save that reference. Please contact the store and share your order ID.')
    } finally {
      setSavingReference(false)
    }
  }
  return <section className="confirmation-section section"><div className="confirmation-mark"><Check size={28} /></div><Eyebrow>ORDER REQUEST RECEIVED</Eyebrow><h1>A lovely little<br /><em>next step.</em></h1><p>Your order reference is <strong>{id}</strong>. The store will confirm availability and the final total before dispatch.</p>{amount !== null && <div className="payment-instructions"><h2>Manual UPI payment</h2><p>Only pay after confirming the final amount with the store. Never share your UPI PIN or OTP.</p>{upiId ? <div className="upi-id"><span>{upiId}</span><button onClick={() => void navigator.clipboard.writeText(upiId)}>Copy UPI ID</button></div> : <p className="muted-note">UPI ID has not been configured by the store.</p>}{paymentUri && <a className="button button-dark" href={paymentUri}>Open UPI app · {money(amount)} <ArrowRight size={16} /></a>}<label className="field-label">Transaction reference<input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Enter after you have paid" /></label><button className="button button-outline button-full" disabled={savingReference} onClick={() => void saveReference()}>{savingReference ? 'Sending reference…' : 'Send reference to store'} <ArrowRight size={15} /></button><p className="payment-pending">Payment verification pending. The store will verify it manually.</p></div>}{notice && <p className="form-notice">{notice}</p>}<Link className="button button-outline" to="/account">View your account <ArrowRight size={16} /></Link><p className="muted-note">Entering a transaction reference does not mark an order as paid.</p></section>
}

function OrderConfirmationPage() {
  const { id } = useParams()
  return <section className="confirmation-section section"><div className="confirmation-mark"><Check size={28} /></div><Eyebrow>ORDER REQUEST RECEIVED</Eyebrow><h1>Thank you for<br /><em>your little order.</em></h1><p>Your order reference is <strong>{id}</strong>. The store will confirm your items, availability, shipping and final payable amount before dispatch.</p><div className="confirmation-status"><span className="status-dot" /> Order placed · Payment pending</div><p className="muted-note">This is not a payment confirmation. The store will contact you using the details provided at checkout.</p><Link className="button button-dark" to="/account">See your orders <ArrowRight size={16} /></Link></section>
}

function safeNextPath(path: string | null) {
  if (!path || !path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return '/'
  const pathname = path.split(/[?#]/, 1)[0]
  if (['/login', '/register', '/forgot-password'].includes(pathname)) return '/'
  return path
}

function AuthPage({ mode }: { mode: 'login' | 'register' | 'reset' }) {
  const { user } = useStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [name, setName] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const nextPath = safeNextPath(params.get('next'))
  const nextQuery = nextPath === '/' ? '' : `?next=${encodeURIComponent(nextPath)}`
  const entryPath = mode === 'login' ? '/register' : '/login'
  const entryLabel = mode === 'login' ? 'Create an account' : 'Back to sign in'
  useEffect(() => {
    if (user && mode !== 'reset') navigate(nextPath, { replace: true })
  }, [user, mode, navigate, nextPath])
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (mode === 'register' && !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,}$/.test(password)) {
      setError('Use at least 8 characters with an uppercase letter, a lowercase letter, a number, and a symbol.')
      return
    }
    if (!auth) {
      setError('Customer accounts are not enabled until Firebase is configured.')
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      if (mode === 'reset') {
        await sendPasswordResetEmail(auth, email)
        setNotice('If an account exists for this email, a password reset link is on its way.')
      } else if (mode === 'register') {
        const credential = await createUserWithEmailAndPassword(auth, email, password)
        if (name.trim()) await updateProfile(credential.user, { displayName: name.trim() })
        await sendEmailVerification(credential.user)
        setNotice('Your account is ready. Please check your email to verify your address.')
      } else {
        await signInWithEmailAndPassword(auth, email, password)
        navigate(nextPath, { replace: true })
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'We could not complete that request.')
    } finally {
      setBusy(false)
    }
  }
  const title = mode === 'register' ? 'Start a lovely chapter.' : mode === 'reset' ? 'Let’s find your way back.' : 'Welcome back.'
  return (
    <section className="auth-section section">
      <div className="auth-card">
        <Link className="back-link" to={`${entryPath}${nextQuery}`}>
          <ArrowLeft size={15} /> {entryLabel}
        </Link>
        <Eyebrow>YOUR LITTLE CORNER</Eyebrow>
        <h1>{title}</h1>
        <p>{mode === 'register' ? 'Create an account to enter the store and keep your orders together.' : mode === 'reset' ? 'Enter your email and we’ll send a password reset link.' : 'Sign in to enter The Fabric Chapter.'}</p>
        <form onSubmit={submit}>
          {mode === 'register' && <TextField label="Full name" value={name} onChange={setName} required />}
          <TextField label="Email address" type="email" value={email} onChange={setEmail} required />
          {mode !== 'reset' && (
            <label className="field-label">
              Password
              <span className="password-control">
                <input
                  type={showPassword ? 'text' : 'password'}
                  minLength={mode === 'register' ? 8 : 6}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <button
                  className="password-visibility"
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
              {mode === 'register' && <span className="password-hint">At least 8 characters, with uppercase and lowercase letters, a number, and a symbol.</span>}
            </label>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
          {notice && <p className="form-notice" role="status">{notice}</p>}
          <button className="button button-dark button-full" disabled={busy}>
            {busy ? 'One moment…' : mode === 'register' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Sign in'} <ArrowRight size={16} />
          </button>
        </form>
        {mode === 'login' && <Link className="text-link auth-reset" to={`/forgot-password${nextQuery}`}>Forgot your password?</Link>}
        {mode === 'login'
          ? <p className="auth-switch">New around here? <Link to={`/register${nextQuery}`}>Create an account</Link></p>
          : mode === 'register'
            ? <p className="auth-switch">Already have an account? <Link to={`/login${nextQuery}`}>Sign in</Link></p>
            : <p className="auth-switch"><Link to={`/login${nextQuery}`}>Back to sign in</Link></p>}
      </div>
    </section>
  )
}

function AccountPage() {
  const { user, cart } = useStore()
  const [orders, setOrders] = useState<Record<string, unknown>[]>([])
  const [error, setError] = useState('')
  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [profileNotice, setProfileNotice] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  useEffect(() => {
    if (!user) return
    setDisplayName(user.displayName ?? '')
    return watchCustomerOrders(
      user.uid,
      setOrders,
      () => setError('Order history is not available right now.'),
    )
  }, [user])
  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user) return
    const cleanName = displayName.trim()
    if (!cleanName || cleanName.length > 80) {
      setProfileNotice('Enter a name using 1 to 80 characters.')
      return
    }
    setSavingProfile(true)
    setProfileNotice('')
    try {
      await updateProfile(user, { displayName: cleanName })
      setDisplayName(cleanName)
      setProfileNotice('Your profile name has been updated.')
    } catch {
      setProfileNotice('We could not update your profile right now.')
    } finally {
      setSavingProfile(false)
    }
  }
  if (!user) return <EmptyPage title="Your little corner awaits." detail="Sign in to see saved details and order updates." action={<Link className="button button-dark" to="/login">Sign in <ArrowRight size={16} /></Link>} />
  return (
    <section className="account-section section">
      <div className="account-welcome">
        <Eyebrow>YOUR LITTLE CORNER</Eyebrow>
        <h1>Hello, <em>{displayName.split(' ')[0] || 'lovely'}.</em></h1>
        <p>{user.email || user.phoneNumber || 'Signed-in customer'}</p>
        {user.email && !user.emailVerified && <EmailVerificationPrompt user={user} />}
        <button className="text-link" onClick={() => auth && void signOut(auth)}>Sign out <ArrowRight size={15} /></button>
      </div>
      <form className="account-profile" onSubmit={saveProfile}>
        <div><Eyebrow>YOUR DETAILS</Eyebrow><h2>Profile</h2></div>
        <label className="field-label">Full name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={80} required /></label>
        <p className="muted-note">Sign-in email and phone number are managed by Firebase Authentication.</p>
        <button className="button button-outline" type="submit" disabled={savingProfile}>{savingProfile ? 'Saving…' : 'Save profile'} <Check size={15} /></button>
        {profileNotice && <p className="form-notice" role="status">{profileNotice}</p>}
      </form>
      <div className="account-orders">
        <div className="section-heading">
          <div><Eyebrow>THE LITTLE THINGS ON THEIR WAY</Eyebrow><h2>Your orders</h2></div>
          <Link className="text-link" to="/shop">Find something lovely <ArrowRight size={15} /></Link>
        </div>
        {error ? <p className="form-error">{error}</p> : orders.length ? (
          <div className="order-list">{orders.map((order) => (
            <article className="order-row" key={String(order.id)}>
              <div><Eyebrow>ORDER {String(order.id).slice(0, 8).toUpperCase()}</Eyebrow><strong>{String(order.orderStatus ?? 'Order placed')}</strong></div>
              <span>{String(order.paymentStatus ?? 'Pending')}</span>
              <strong>{money(Number(order.total ?? 0))}</strong>
            </article>
          ))}</div>
        ) : <div className="empty-collection compact"><h3>No orders just yet.</h3><p>Your first lovely order will show up here.</p></div>}
      </div>
      <div className="account-shortcuts">
        <Link to="/wishlist"><Heart size={18} /> Your wishlist</Link>
        <Link to="/bag"><ShoppingBag size={18} /> Shopping bag ({cart.length})</Link>
      </div>
    </section>
  )
}

function AdminPage() {
  const { user, refreshCatalog } = useStore()
  const [allowed, setAllowed] = useState(false)
  const [checking, setChecking] = useState(true)
  const [items, setItems] = useState<Product[]>([])
  const [hampers, setHampers] = useState<Hamper[]>([])
  const [orders, setOrders] = useState<Record<string, unknown>[]>([])
  const [paymentReferences, setPaymentReferences] = useState<Record<string, string>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingHamperId, setEditingHamperId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [hamperMessage, setHamperMessage] = useState('')
  const [dashboardError, setDashboardError] = useState('')
  const [orderNotice, setOrderNotice] = useState('')
  const knownOrderIds = useRef<Set<string> | null>(null)
  useEffect(() => {
    if (!user) {
      setAllowed(false)
      setChecking(false)
      return
    }
    let active = true
    let receivedInitialServerOrders = false
    const stopWatching: (() => void)[] = []
    setChecking(true)
    setDashboardError('')
    setOrderNotice('')
    knownOrderIds.current = null
    void isStoreAdmin(user.uid).then(async (result) => {
      if (!active) return
      setAllowed(result)
      if (!result) return
      const [products, publishedHampers] = await Promise.all([
        getAdminProducts(),
        getAdminHampers(),
      ])
      if (!active) return
      setItems(products)
      setHampers(publishedHampers)
      stopWatching.push(watchAdminOrders((latestOrders, fromCache) => {
        const nextIds = new Set(latestOrders.map((order) => String(order.id)))
        if (!fromCache && receivedInitialServerOrders && knownOrderIds.current) {
          const newCount = [...nextIds].filter((id) => !knownOrderIds.current?.has(id)).length
          if (newCount > 0) {
            setOrderNotice(`${newCount} new order${newCount === 1 ? '' : 's'} received.`)
          }
        }
        if (!fromCache) {
          receivedInitialServerOrders = true
          knownOrderIds.current = nextIds
        }
        setOrders(latestOrders)
      }, (error) => setDashboardError(error.message)))
      stopWatching.push(watchAdminPaymentReferences(
        setPaymentReferences,
        (error) => setDashboardError(error.message),
      ))
    }).catch((error: unknown) => {
      if (!active) return
      setAllowed(false)
      setDashboardError(error instanceof Error ? error.message : 'The admin dashboard could not be loaded.')
    }).finally(() => {
      if (active) setChecking(false)
    })
    return () => {
      active = false
      stopWatching.forEach((stop) => stop())
    }
  }, [user])
  if (!user) return <EmptyPage title="Store team only." detail="Sign in with an administrator account provisioned by the store owner." action={<Link className="button button-dark" to="/login">Sign in <ArrowRight size={16} /></Link>} />
  if (checking) return <div className="section catalog-message">Checking store access…</div>
  if (!allowed) return <EmptyPage title="This corner is just for the store team." detail="Administrator access is granted securely through the Firebase admins collection. Customer accounts cannot enable it." />
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const value: Omit<Product, 'id'> = {
      name: String(form.get('name') ?? '').trim(),
      description: String(form.get('description') ?? '').trim(),
      categoryId: String(form.get('categoryId') ?? ''),
      price: Number(form.get('price')),
      discountPrice: form.get('discountPrice') ? Number(form.get('discountPrice')) : undefined,
      stock: Number(form.get('stock')),
      active: form.get('active') === 'on',
      colors: String(form.get('colors') ?? '').split(',').map((color) => color.trim()).filter(Boolean),
      imageUrl: String(form.get('imageUrl') ?? '').trim() || undefined,
    }
    if (!value.name || !Number.isFinite(value.price) || value.price < 0 ||
      !Number.isInteger(value.stock) || value.stock < 0 ||
      (value.discountPrice !== undefined && (value.discountPrice < 0 || value.discountPrice > value.price))) {
      setMessage('Please check the product name, price, discount and stock.')
      return
    }
    try {
      await saveProduct(value, editingId ?? undefined)
      setItems(await getAdminProducts())
      await refreshCatalog()
      formElement.reset()
      setMessage(editingId ? 'Product updated.' : 'Product saved.')
      setEditingId(null)
    } catch (saveError) {
      setMessage(saveError instanceof Error ? saveError.message : 'Could not save this product.')
    }
  }
  const remove = async (id: string) => {
    if (!window.confirm('Remove this product from the store?')) return
    await deleteProduct(id)
    setItems(await getAdminProducts())
    await refreshCatalog()
  }
  const saveGiftHamper = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const value: Omit<Hamper, 'id'> = {
      name: String(form.get('name') ?? '').trim(),
      description: String(form.get('description') ?? '').trim(),
      price: Number(form.get('price')),
      stock: Number(form.get('stock')),
      active: form.get('active') === 'on',
      imageUrl: String(form.get('imageUrl') ?? '').trim() || undefined,
      contents: String(form.get('contents') ?? '').split('\n').map((item) => item.trim()).filter(Boolean),
    }
    if (!value.name || !Number.isFinite(value.price) || value.price < 0 ||
      !Number.isInteger(value.stock) || value.stock < 0) {
      setHamperMessage('Please check the hamper name, price and stock.')
      return
    }
    try {
      await saveHamper(value, editingHamperId ?? undefined)
      setHampers(await getAdminHampers())
      await refreshCatalog()
      formElement.reset()
      setHamperMessage(editingHamperId ? 'Hamper updated.' : 'Hamper saved.')
      setEditingHamperId(null)
    } catch (saveError) {
      setHamperMessage(saveError instanceof Error ? saveError.message : 'Could not save this hamper.')
    }
  }
  const removeHamper = async (id: string) => {
    if (!window.confirm('Remove this hamper from the store?')) return
    try {
      await deleteHamper(id)
      setHampers(await getAdminHampers())
      await refreshCatalog()
    } catch (removeError) {
      setHamperMessage(removeError instanceof Error ? removeError.message : 'Could not remove this hamper.')
    }
  }
  const changeOrder = async (id: string, orderStatus: string, paymentStatus: string) => {
    try {
      await updateOrder(id, { orderStatus, paymentStatus })
      setDashboardError('')
    } catch (updateError) {
      setDashboardError(updateError instanceof Error ? updateError.message : 'Could not update this order.')
    }
  }
  const editingItem = items.find((item) => item.id === editingId)
  const editingHamper = hampers.find((hamper) => hamper.id === editingHamperId)
  const orderStatuses = ['Order Placed', 'Confirmed', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled']
  const paymentStatuses = ['Pending', 'Verification Pending', 'Paid', 'Failed', 'Refunded']
  const orderMetrics = [
    { label: 'Total orders', value: orders.length },
    { label: 'New orders', value: orders.filter((order) => order.orderStatus === 'Order Placed').length },
    { label: 'Pending orders', value: orders.filter((order) => !['Delivered', 'Cancelled'].includes(String(order.orderStatus ?? 'Order Placed'))).length },
    { label: 'Confirmed', value: orders.filter((order) => order.orderStatus === 'Confirmed').length },
    { label: 'Shipped', value: orders.filter((order) => ['Shipped', 'Out for Delivery'].includes(String(order.orderStatus))).length },
    { label: 'Delivered', value: orders.filter((order) => order.orderStatus === 'Delivered').length },
    { label: 'Cancelled', value: orders.filter((order) => order.orderStatus === 'Cancelled').length },
  ]
  return (
    <section className="admin-section section">
      <div className="checkout-heading">
        <Eyebrow>THE BACK OF HOUSE</Eyebrow>
        <h1>Store dashboard</h1>
        <p>Signed in as {user.email || user.phoneNumber}. Admin access is controlled by the owner-managed admins collection and Firestore Rules.</p>
      </div>
      {orderNotice && <div className="admin-order-notice" role="status">{orderNotice}</div>}
      {dashboardError && <p className="form-error" role="alert">{dashboardError}</p>}
      <div className="admin-order-metrics" aria-label="Order summary">
        {orderMetrics.map((metric) => <div className="admin-order-metric" key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong></div>)}
      </div>
      <div className="admin-grid">
        <form className="admin-form" key={editingId ?? 'new'} onSubmit={save}>
          <Eyebrow>{editingItem ? 'UPDATE A REAL PRODUCT' : 'ADD A REAL PRODUCT'}</Eyebrow>
          <h2>Product details</h2>
          <input name="name" aria-label="Product name" required placeholder="Product name" defaultValue={editingItem?.name ?? ''} />
          <textarea name="description" aria-label="Description" required placeholder="Product description" defaultValue={editingItem?.description ?? ''} />
          <select name="categoryId" aria-label="Category" required defaultValue={editingItem?.categoryId ?? ''}>
            <option value="">Choose a category</option>
            <option value="scrunchies">Scrunchies</option>
            <option value="hair-clips">Hair clips</option>
          </select>
          <div className="form-grid">
            <input type="number" name="price" aria-label="Price in INR" min="0" required placeholder="Price in INR" defaultValue={editingItem?.price ?? ''} />
            <input type="number" name="discountPrice" aria-label="Discount price in INR" min="0" placeholder="Discount price (optional)" defaultValue={editingItem?.discountPrice ?? ''} />
            <input type="number" name="stock" aria-label="Stock" min="0" required placeholder="Stock quantity" defaultValue={editingItem?.stock ?? ''} />
            <input name="colors" aria-label="Available colours" placeholder="Colours, separated by commas" defaultValue={editingItem?.colors?.join(', ') ?? ''} />
          </div>
          <input type="url" name="imageUrl" aria-label="Product image URL" placeholder="Product image URL (optional)" defaultValue={editingItem?.imageUrl ?? ''} />
          <label className="check-row"><input name="active" type="checkbox" defaultChecked={editingItem?.active ?? true} /><span>Publish in the store</span></label>
          <div className="admin-form-actions">
            <button className="button button-dark" type="submit">{editingItem ? 'Update product' : 'Save product'} <Check size={16} /></button>
            {editingItem && <button className="text-link" type="button" onClick={() => setEditingId(null)}>Cancel edit</button>}
          </div>
          {message && <p className="form-notice">{message}</p>}
        </form>
        <div className="admin-products">
          <Eyebrow>LIVE PRODUCT RECORDS</Eyebrow>
          <h2>Products ({items.length})</h2>
          {items.map((item) => (
            <div className="admin-product-row" key={item.id}>
              <span><strong>{item.name}</strong><small>{item.categoryId} · stock {item.stock} · {item.active ? 'Published' : 'Hidden'}</small></span>
              <div className="admin-row-actions">
                <button className="text-link" onClick={() => setEditingId(item.id)}>Edit</button>
                <button className="icon-button" aria-label={`Remove ${item.name}`} onClick={() => void remove(item.id)}><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
          {!items.length && <p className="muted-note">No products are in the catalog yet. Only real store inventory should be added here.</p>}
        </div>
      </div>
      <div className="admin-grid admin-hamper-grid">
        <form className="admin-form" key={editingHamperId ?? 'new-hamper'} onSubmit={saveGiftHamper}>
          <Eyebrow>{editingHamper ? 'UPDATE A READY-MADE GIFT' : 'ADD A READY-MADE GIFT'}</Eyebrow>
          <h2>Hamper details</h2>
          <input name="name" aria-label="Hamper name" required placeholder="Hamper name" defaultValue={editingHamper?.name ?? ''} />
          <textarea name="description" aria-label="Hamper description" required placeholder="Hamper description" defaultValue={editingHamper?.description ?? ''} />
          <div className="form-grid">
            <input type="number" name="price" aria-label="Hamper price in INR" min="0" required placeholder="Price in INR" defaultValue={editingHamper?.price ?? ''} />
            <input type="number" name="stock" aria-label="Hamper stock" min="0" step="1" required placeholder="Stock quantity" defaultValue={editingHamper?.stock ?? ''} />
          </div>
          <textarea name="contents" aria-label="Hamper contents" placeholder="Contents, one per line" defaultValue={editingHamper?.contents?.join('\n') ?? ''} />
          <input type="url" name="imageUrl" aria-label="Hamper image URL" placeholder="Image URL (optional)" defaultValue={editingHamper?.imageUrl ?? ''} />
          <label className="check-row"><input name="active" type="checkbox" defaultChecked={editingHamper?.active ?? true} /><span>Publish in the store</span></label>
          <div className="admin-form-actions">
            <button className="button button-dark" type="submit">{editingHamper ? 'Update hamper' : 'Save hamper'} <Check size={16} /></button>
            {editingHamper && <button className="text-link" type="button" onClick={() => setEditingHamperId(null)}>Cancel edit</button>}
          </div>
          {hamperMessage && <p className="form-notice" role="status">{hamperMessage}</p>}
        </form>
        <div className="admin-products">
          <Eyebrow>LIVE HAMPER RECORDS</Eyebrow>
          <h2>Hampers ({hampers.length})</h2>
          {hampers.map((hamper) => (
            <div className="admin-product-row" key={hamper.id}>
              <span><strong>{hamper.name}</strong><small>{money(hamper.price)} · stock {hamper.stock} · {hamper.active ? 'Published' : 'Hidden'}</small></span>
              <div className="admin-row-actions">
                <button className="text-link" onClick={() => setEditingHamperId(hamper.id)}>Edit</button>
                <button className="icon-button" aria-label={`Remove ${hamper.name}`} onClick={() => void removeHamper(hamper.id)}><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
          {!hampers.length && <p className="muted-note">No ready-made hampers are published.</p>}
        </div>
      </div>
      <div className="admin-orders">
        <Eyebrow>STORE-FACING ORDER REVIEW</Eyebrow>
        <h2>Orders ({orders.length})</h2>
        {!orders.length && <p className="muted-note">New customer order requests will appear here.</p>}
        {orders.map((order) => {
          const id = String(order.id)
          const orderItems = Array.isArray(order.items) ? order.items as CartLine[] : []
          const address = order.address as Partial<Address> | undefined
          const gift = order.gift as { recipientName?: string; recipientPhone?: string; senderName?: string; giftMessage?: string } | undefined
          const createdAt = order.createdAt as { toDate?: () => Date } | undefined
          const placedAt = createdAt?.toDate ? createdAt.toDate().toLocaleString() : 'Timestamp pending'
          return (
            <article className="admin-order" key={id}>
              <div className="admin-order-heading">
                <span><Eyebrow>ORDER {String(order.orderId ?? id).slice(0, 8).toUpperCase()}</Eyebrow><strong>{money(Number(order.total ?? 0))} · {orderItems.length} line items</strong></span>
                <span>{String(order.orderStatus ?? 'Order Placed')} · {String(order.paymentMethod ?? '')} · {String(order.paymentStatus ?? 'Pending')}</span>
              </div>
              <details className="admin-order-details">
                <summary>View items and delivery details</summary>
                <p>Order ID: {String(order.orderId ?? id)}<br />Placed: {placedAt}<br />Customer ID: {String(order.userId ?? '')}</p>
                <p>Subtotal: {money(Number(order.subtotal ?? 0))} · Shipping: {money(Number(order.shipping ?? 0))}</p>
                <ul>
                  {orderItems.map((line) => {
                    const details = line.details as { products?: { name: string; quantity: number; color?: string | null; unitPrice?: number }[] } | undefined
                    return (
                      <li key={line.key}>
                        {line.quantity} × {line.name}{line.color ? ` · ${line.color}` : ''} · {money(Number(line.unitPrice ?? 0))} each
                        {details?.products?.map((item) => (
                          <small key={`${line.key}-${item.name}`}> · {item.quantity} × {item.name}{item.color ? ` · ${item.color}` : ''} ({money(Number(item.unitPrice ?? 0))} each)</small>
                        ))}
                      </li>
                    )
                  })}
                </ul>
                {address && <p>{address.fullName} · {address.phone} · {address.email}<br />{address.house}, {address.street}, {address.area}, {address.city}, {address.state} {address.pinCode}</p>}
                {gift && <p>Gift for {gift.recipientName} · {gift.recipientPhone}<br />From {gift.senderName}<br />{gift.giftMessage}</p>}
                {String(order.paymentMethod) === 'UPI' && <p>Customer reference (unverified): {paymentReferences[id] || 'No reference submitted.'}</p>}
              </details>
              <div className="admin-order-controls">
                <label>Status<select value={String(order.orderStatus ?? 'Order Placed')} onChange={(event) => void changeOrder(id, event.target.value, String(order.paymentStatus ?? 'Pending'))}>{orderStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
                <label>Payment<select value={String(order.paymentStatus ?? 'Pending')} onChange={(event) => void changeOrder(id, String(order.orderStatus ?? 'Order Placed'), event.target.value)}>{paymentStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
              </div>
            </article>
          )
        })}
        <p className="muted-note">Verify UPI receipts outside this website before manually selecting “Paid”. Inventory is not reserved automatically.</p>
      </div>
    </section>
  )
}

function InfoPage({ type }: { type: 'about' | 'contact' | 'faq' }) {
  const content = {
    about: { eyebrow: 'A LITTLE ABOUT US', title: 'A little lovely, made with care.', intro: 'The Fabric Chapter is a small Indian boutique for thoughtful hair accessories and gifts that make everyday moments feel a little more special.', paragraphs: ['We believe the smallest things often hold the biggest feelings: a favourite scrunchie, a clip borrowed and kept, a box picked just for you.', 'Every chapter is still being written. We’re glad you found your way here.'] },
    contact: { eyebrow: 'WE’RE HERE FOR YOU', title: 'Say a little hello.', intro: 'Questions about a product, an order, or a gift? We would love to hear from you.', paragraphs: ['Our store email, WhatsApp number and Instagram profile will be added here by the store owner. No contact details have been published yet.', 'Please check back soon for ways to get in touch.'] },
    faq: { eyebrow: 'A FEW LITTLE ANSWERS', title: 'Good things to know.', intro: 'A few helpful notes while we get the store ready.', paragraphs: ['Orders are confirmed by the store after checking product availability, delivery details and final shipping charges.', 'Manual UPI payments are verified by the store. Never share a UPI PIN or OTP. Online card payments are not enabled.', 'Shipping, returns and delivery timelines will be published by the store before orders are accepted.'] },
  }[type]
  return <section className="info-page section"><Link className="back-link" to="/"><ArrowLeft size={15} /> Back to the beginning</Link><Eyebrow>{content.eyebrow}</Eyebrow><h1>{content.title}</h1><p className="info-intro">{content.intro}</p><div className="info-flower">✳</div>{content.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{type === 'contact' && <Link className="button button-dark" to="/shop">Explore the collection <ArrowRight size={16} /></Link>}</section>
}

function PolicyPage() {
  const { policy } = useParams()
  const name = policy === 'shipping' ? 'Shipping policy' : policy === 'returns' ? 'Returns & refunds' : policy === 'terms' ? 'Terms & conditions' : 'Privacy policy'
  return <section className="info-page section"><Link className="back-link" to="/"><ArrowLeft size={15} /> Back to the beginning</Link><Eyebrow>THE IMPORTANT LITTLE DETAILS</Eyebrow><h1>{name}</h1><p className="info-intro">This policy will be completed by the store owner before orders are accepted.</p><div className="policy-notice"><LockKeyhole size={19} /><p>No delivery timelines, return windows or legal terms have been invented. Please contact the store for current information before placing an order.</p></div></section>
}

function EmptyPage({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return <section className="empty-page section"><Link className="back-link" to="/"><ArrowLeft size={15} /> Back to the beginning</Link><span className="empty-page-flower">✳</span><Eyebrow>A LITTLE PAUSE</Eyebrow><h1>{title}</h1><p>{detail}</p>{action}</section>
}

function NotFoundPage() {
  return <EmptyPage title="This page took a different turn." detail="Let's find our way back to the lovely things." action={<Link className="button button-dark" to="/">Back to home <ArrowRight size={16} /></Link>} />
}

export default App
