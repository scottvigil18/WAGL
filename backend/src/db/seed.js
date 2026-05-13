/**
 * Seed script — populates products and reviews tables.
 * Safe to re-run: skips insert if products already exist.
 */
const db = require('./database');

// Unsplash photo IDs — free, no API key needed, consistent images
// Format: https://images.unsplash.com/photo-{id}?w=600&q=80&fit=crop
const products = [
  {
    name: "Wireless Noise-Cancelling Headphones",
    emoji: "🎧",
    image_url: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80&fit=crop",
    category: "Electronics",
    price: 79.99,
    original_price: 129.99,
    rating: 4.5,
    stock: 15,
    badge: "Sale",
    description: "Immerse yourself in crystal-clear audio with our premium wireless headphones. Featuring active noise cancellation, 30-hour battery life, and ultra-comfortable ear cushions for all-day wear.",
    features: ["Active Noise Cancellation", "30-hour battery life", "Bluetooth 5.0", "Foldable design", "Built-in microphone"],
    reviews: [
      { name: "Alex M.", rating: 5, date: "Apr 20, 2026", comment: "Absolutely love these! The noise cancellation is incredible and the sound quality is top-notch." },
      { name: "Sarah K.", rating: 4, date: "Mar 15, 2026", comment: "Great headphones for the price. Battery life is amazing. Slightly tight on my head at first but got comfortable." },
      { name: "James T.", rating: 5, date: "Feb 28, 2026", comment: "Best purchase I've made this year. Perfect for working from home." }
    ]
  },
  {
    name: "Mechanical Gaming Keyboard",
    emoji: "⌨️",
    image_url: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&q=80&fit=crop",
    category: "Electronics",
    price: 59.99,
    original_price: null,
    rating: 4.0,
    stock: 22,
    badge: null,
    description: "Elevate your gaming experience with tactile mechanical switches, customizable RGB backlighting, and a durable aluminum frame built to last through intense gaming sessions.",
    features: ["Cherry MX Blue switches", "Per-key RGB lighting", "Aluminum frame", "Anti-ghosting", "USB-C detachable cable"],
    reviews: [
      { name: "Chris P.", rating: 4, date: "May 1, 2026", comment: "Solid keyboard. The switches feel great and the RGB is vibrant. A bit loud but that's expected with blues." },
      { name: "Dana L.", rating: 4, date: "Apr 10, 2026", comment: "Good build quality. Took a while to get used to the clicky sound but now I love it." }
    ]
  },
  {
    name: "Stainless Steel Water Bottle",
    emoji: "🍶",
    image_url: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&q=80&fit=crop",
    category: "Kitchen",
    price: 24.99,
    original_price: null,
    rating: 5.0,
    stock: 50,
    badge: "Best Seller",
    description: "Stay hydrated in style with our double-wall insulated stainless steel bottle. Keeps drinks cold for 24 hours and hot for 12 hours. BPA-free and eco-friendly.",
    features: ["Double-wall insulation", "24h cold / 12h hot", "BPA-free", "Leak-proof lid", "Fits most cup holders"],
    reviews: [
      { name: "Mia R.", rating: 5, date: "May 5, 2026", comment: "This bottle is amazing! My coffee stays hot all morning. Great quality for the price." },
      { name: "Tom B.", rating: 5, date: "Apr 22, 2026", comment: "Bought three of these for my family. Everyone loves them. No leaks at all." },
      { name: "Lily W.", rating: 5, date: "Mar 30, 2026", comment: "Perfect size and keeps my water ice cold all day even in summer heat." }
    ]
  },
  {
    name: "Yoga Mat with Carry Strap",
    emoji: "🧘",
    image_url: "https://images.unsplash.com/photo-1601925228008-f5e4c5e5e5e5?w=600&q=80&fit=crop",
    category: "Sports",
    price: 34.99,
    original_price: 44.99,
    rating: 4.5,
    stock: 30,
    badge: "Sale",
    description: "Find your balance with our premium non-slip yoga mat. Made from eco-friendly TPE material with alignment lines to perfect your poses. Includes a convenient carry strap.",
    features: ["Non-slip surface", "Eco-friendly TPE", "6mm thick cushioning", "Alignment lines", "Free carry strap"],
    reviews: [
      { name: "Nina S.", rating: 5, date: "Apr 18, 2026", comment: "Best yoga mat I've ever used. The grip is excellent and it's very comfortable." },
      { name: "Paul G.", rating: 4, date: "Mar 20, 2026", comment: "Good mat, nice thickness. The carry strap is a bonus. Slight smell when new but fades quickly." }
    ]
  },
  {
    name: "Scented Soy Candle Set",
    emoji: "🕯️",
    image_url: "https://images.unsplash.com/photo-1603006905003-be475563bc59?w=600&q=80&fit=crop",
    category: "Home Decor",
    price: 29.99,
    original_price: null,
    rating: 4.5,
    stock: 40,
    badge: null,
    description: "Transform your space with our hand-poured soy candle set. Each set includes 3 candles in relaxing scents: Lavender, Vanilla Bean, and Eucalyptus Mint. Burns cleanly for 45+ hours each.",
    features: ["100% natural soy wax", "45+ hour burn time", "3 relaxing scents", "Cotton wick", "Reusable glass jars"],
    reviews: [
      { name: "Emma J.", rating: 5, date: "May 3, 2026", comment: "These smell absolutely divine! The lavender one is my favorite. Great gift idea too." },
      { name: "Ryan C.", rating: 4, date: "Apr 5, 2026", comment: "Nice candles, good scent throw. The jars are beautiful and I'm reusing them as planters." }
    ]
  },
  {
    name: "Portable Bluetooth Speaker",
    emoji: "🔊",
    image_url: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600&q=80&fit=crop",
    category: "Electronics",
    price: 49.99,
    original_price: 69.99,
    rating: 4.0,
    stock: 18,
    badge: "Sale",
    description: "Take your music anywhere with this rugged waterproof Bluetooth speaker. Delivers 360° surround sound with deep bass, and a 12-hour battery keeps the party going all day.",
    features: ["IPX7 waterproof", "360° surround sound", "12-hour battery", "Bluetooth 5.0", "Built-in microphone"],
    reviews: [
      { name: "Jake H.", rating: 4, date: "Apr 28, 2026", comment: "Great sound for its size. Took it to the beach and it survived a splash. Very happy with it." },
      { name: "Chloe N.", rating: 4, date: "Mar 12, 2026", comment: "Good speaker. Bass is surprisingly strong. Battery life is as advertised." }
    ]
  },
  {
    name: "Ceramic Coffee Mug",
    emoji: "☕",
    image_url: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=600&q=80&fit=crop",
    category: "Kitchen",
    price: 14.99,
    original_price: null,
    rating: 4.5,
    stock: 60,
    badge: null,
    description: "Start your morning right with our hand-crafted ceramic mug. Holds 16oz of your favorite brew, features a comfortable grip handle, and is dishwasher and microwave safe.",
    features: ["16oz capacity", "Hand-crafted ceramic", "Dishwasher safe", "Microwave safe", "Comfortable grip handle"],
    reviews: [
      { name: "Olivia F.", rating: 5, date: "May 8, 2026", comment: "Love this mug! It's the perfect size and feels great in my hands. The design is beautiful." },
      { name: "Ethan M.", rating: 4, date: "Apr 14, 2026", comment: "Solid mug, good weight. Keeps coffee warm longer than my old mugs." }
    ]
  },
  {
    name: "Running Shoes",
    emoji: "👟",
    image_url: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80&fit=crop",
    category: "Sports",
    price: 89.99,
    original_price: 119.99,
    rating: 4.5,
    stock: 25,
    badge: "Sale",
    description: "Hit the pavement in comfort with our lightweight running shoes. Engineered with responsive foam cushioning, breathable mesh upper, and a durable rubber outsole for all-terrain performance.",
    features: ["Responsive foam cushioning", "Breathable mesh upper", "Durable rubber outsole", "Lightweight design", "Available in 6 colors"],
    reviews: [
      { name: "Lucas A.", rating: 5, date: "May 2, 2026", comment: "These are the most comfortable running shoes I've owned. My knees thank me!" },
      { name: "Ava B.", rating: 4, date: "Apr 7, 2026", comment: "Great shoes, very lightweight. Runs slightly small so order half a size up." }
    ]
  },
  {
    name: "Succulent Plant Collection",
    emoji: "🌵",
    image_url: "https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?w=600&q=80&fit=crop",
    category: "Plants",
    price: 19.99,
    original_price: null,
    rating: 5.0,
    stock: 35,
    badge: "New",
    description: "Brighten up your home or office with our curated set of 4 live succulents. Each plant comes in a cute terracotta pot and is hand-selected for health and variety.",
    features: ["4 live succulents", "Terracotta pots included", "Low maintenance", "Hand-selected plants", "Care guide included"],
    reviews: [
      { name: "Sophie L.", rating: 5, date: "May 10, 2026", comment: "All four plants arrived healthy and beautiful! The pots are adorable. Perfect desk decoration." },
      { name: "Ben K.", rating: 5, date: "Apr 25, 2026", comment: "Great quality plants. The care guide was very helpful. All still thriving weeks later." }
    ]
  },
  {
    name: "Leather Wallet",
    emoji: "👛",
    image_url: "https://images.unsplash.com/photo-1627123424574-724758594e93?w=600&q=80&fit=crop",
    category: "Accessories",
    price: 39.99,
    original_price: null,
    rating: 4.0,
    stock: 20,
    badge: null,
    description: "Slim, stylish, and built to last. Our genuine leather bifold wallet features 6 card slots, a bill compartment, and RFID blocking technology to keep your cards safe.",
    features: ["Genuine leather", "RFID blocking", "6 card slots", "Bill compartment", "Slim profile"],
    reviews: [
      { name: "Noah D.", rating: 4, date: "Apr 30, 2026", comment: "Nice wallet, good leather quality. Slim enough to fit in my front pocket comfortably." },
      { name: "Zoe P.", rating: 4, date: "Mar 18, 2026", comment: "Bought as a gift and the recipient loved it. Looks premium and the RFID blocking is a great feature." }
    ]
  },
  {
    name: "Desk Lamp with USB Charging",
    emoji: "🪔",
    image_url: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600&q=80&fit=crop",
    category: "Home Office",
    price: 44.99,
    original_price: 54.99,
    rating: 4.5,
    stock: 12,
    badge: "Sale",
    description: "Illuminate your workspace with our modern LED desk lamp. Features 5 brightness levels, 3 color temperatures, a built-in USB charging port, and a flexible gooseneck arm.",
    features: ["5 brightness levels", "3 color temperatures", "USB-A charging port", "Flexible gooseneck", "Touch controls"],
    reviews: [
      { name: "Isla T.", rating: 5, date: "May 6, 2026", comment: "Perfect lamp for my home office. The USB port is super convenient and the light quality is excellent." },
      { name: "Finn O.", rating: 4, date: "Apr 11, 2026", comment: "Good lamp, easy to adjust. The touch controls are responsive. Great value." }
    ]
  },
  {
    name: "Instant Pot Pressure Cooker",
    emoji: "🍲",
    image_url: "https://images.unsplash.com/photo-1585515320310-259814833e62?w=600&q=80&fit=crop",
    category: "Kitchen",
    price: 69.99,
    original_price: 99.99,
    rating: 5.0,
    stock: 8,
    badge: "Hot Deal",
    description: "Cook delicious meals in a fraction of the time with our 7-in-1 electric pressure cooker. Pressure cook, slow cook, sauté, steam, and more — all in one pot.",
    features: ["7-in-1 functionality", "6-quart capacity", "14 smart programs", "Delay start timer", "Dishwasher-safe parts"],
    reviews: [
      { name: "Grace V.", rating: 5, date: "May 9, 2026", comment: "This changed my cooking life! Meals that used to take hours now take 20 minutes. Absolutely love it." },
      { name: "Henry U.", rating: 5, date: "Apr 16, 2026", comment: "Best kitchen appliance I've ever bought. The slow cook function is perfect for soups." }
    ]
  },
  {
    name: "Sunglasses - Polarized",
    emoji: "🕶️",
    image_url: "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=600&q=80&fit=crop",
    category: "Accessories",
    price: 32.99,
    original_price: null,
    rating: 4.0,
    stock: 45,
    badge: null,
    description: "Shield your eyes in style with our polarized UV400 sunglasses. Lightweight frame, scratch-resistant lenses, and a classic design that suits any face shape.",
    features: ["Polarized lenses", "UV400 protection", "Scratch-resistant", "Lightweight frame", "Includes case & cloth"],
    reviews: [
      { name: "Aria Q.", rating: 4, date: "Apr 29, 2026", comment: "Great sunglasses for the price. The polarization really makes a difference driving." },
      { name: "Leo X.", rating: 4, date: "Mar 22, 2026", comment: "Stylish and functional. The case is a nice bonus. Very happy with this purchase." }
    ]
  },
  {
    name: "Hardcover Notebook",
    emoji: "📓",
    image_url: "https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=600&q=80&fit=crop",
    category: "Stationery",
    price: 16.99,
    original_price: null,
    rating: 4.5,
    stock: 55,
    badge: null,
    description: "Capture your ideas in our premium hardcover notebook. Features 200 pages of thick, fountain-pen friendly paper, a ribbon bookmark, and an elastic closure band.",
    features: ["200 pages", "Fountain-pen friendly paper", "Ribbon bookmark", "Elastic closure", "Lay-flat binding"],
    reviews: [
      { name: "Nora Y.", rating: 5, date: "May 4, 2026", comment: "Beautiful notebook. The paper quality is excellent — no bleed-through even with my fountain pen." },
      { name: "Oscar Z.", rating: 4, date: "Apr 8, 2026", comment: "Solid notebook, great for journaling. The lay-flat binding is very convenient." }
    ]
  },
  {
    name: "Resistance Bands Set",
    emoji: "💪",
    image_url: "https://images.unsplash.com/photo-1598289431512-b97b0917affc?w=600&q=80&fit=crop",
    category: "Sports",
    price: 22.99,
    original_price: null,
    rating: 4.5,
    stock: 38,
    badge: "New",
    description: "Level up your home workouts with our set of 5 resistance bands. Ranging from light to extra-heavy resistance, they're perfect for strength training, stretching, and physical therapy.",
    features: ["5 resistance levels", "Natural latex material", "Includes carry bag", "Suitable for all fitness levels", "Stackable up to 150 lbs"],
    reviews: [
      { name: "Penny A.", rating: 5, date: "May 7, 2026", comment: "These bands are fantastic! Great quality and the variety of resistances is perfect for progressive training." },
      { name: "Quinn B.", rating: 4, date: "Apr 13, 2026", comment: "Good bands, haven't snapped yet after months of use. The carry bag is a nice touch." }
    ]
  },
  {
    name: "Aromatherapy Diffuser",
    emoji: "🌸",
    image_url: "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=600&q=80&fit=crop",
    category: "Home Decor",
    price: 27.99,
    original_price: 37.99,
    rating: 4.0,
    stock: 20,
    badge: "Sale",
    description: "Create a calming atmosphere with our ultrasonic aromatherapy diffuser. Runs up to 8 hours, features 7 LED color options, and operates whisper-quietly for undisturbed relaxation.",
    features: ["8-hour run time", "7 LED color modes", "Whisper-quiet operation", "Auto shut-off", "500ml capacity"],
    reviews: [
      { name: "Ruby C.", rating: 4, date: "Apr 26, 2026", comment: "Love this diffuser! The LED colors are beautiful and it makes my room smell amazing." },
      { name: "Sam D.", rating: 4, date: "Mar 14, 2026", comment: "Works great, very quiet. The auto shut-off gives me peace of mind when I fall asleep." }
    ]
  },
  {
    name: "Wireless Charging Pad",
    emoji: "⚡",
    image_url: "https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=600&q=80&fit=crop",
    category: "Electronics",
    price: 18.99,
    original_price: null,
    rating: 4.0,
    stock: 30,
    badge: null,
    description: "Ditch the cables with our fast wireless charging pad. Compatible with all Qi-enabled devices, charges at up to 15W, and features a non-slip surface to keep your phone in place.",
    features: ["15W fast charging", "Qi-compatible", "Non-slip surface", "LED indicator", "Slim & portable"],
    reviews: [
      { name: "Tara E.", rating: 4, date: "May 1, 2026", comment: "Simple and effective. Charges my phone quickly and the non-slip surface works well." },
      { name: "Uma F.", rating: 4, date: "Apr 3, 2026", comment: "Good charger, does exactly what it says. Compact enough to travel with." }
    ]
  },
  {
    name: "Bamboo Cutting Board",
    emoji: "🪵",
    image_url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80&fit=crop",
    category: "Kitchen",
    price: 21.99,
    original_price: null,
    rating: 4.5,
    stock: 42,
    badge: null,
    description: "Upgrade your kitchen prep with our eco-friendly bamboo cutting board. Features a juice groove to catch drips, non-slip feet for safety, and a built-in handle for easy carrying.",
    features: ["Eco-friendly bamboo", "Juice groove", "Non-slip feet", "Built-in handle", "Knife-friendly surface"],
    reviews: [
      { name: "Vera G.", rating: 5, date: "Apr 27, 2026", comment: "Beautiful cutting board! The juice groove is very practical and it's held up great after months of use." },
      { name: "Will H.", rating: 4, date: "Mar 25, 2026", comment: "Solid board, good size. Easy to clean and looks great in my kitchen." }
    ]
  },
  {
    name: "Backpack - 30L",
    emoji: "🎒",
    image_url: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80&fit=crop",
    category: "Accessories",
    price: 54.99,
    original_price: 74.99,
    rating: 4.5,
    stock: 16,
    badge: "Sale",
    description: "Adventure-ready and everyday practical, our 30L backpack features a padded laptop sleeve, multiple organizer pockets, breathable back panel, and water-resistant fabric.",
    features: ["30L capacity", "Padded 15\" laptop sleeve", "Water-resistant fabric", "Breathable back panel", "USB charging port pass-through"],
    reviews: [
      { name: "Xena I.", rating: 5, date: "May 5, 2026", comment: "Perfect backpack! Fits my laptop, gym clothes, and lunch with room to spare. Very comfortable to wear." },
      { name: "Yuri J.", rating: 4, date: "Apr 19, 2026", comment: "Great bag for the price. The USB pass-through is a clever feature. Straps are comfortable." }
    ]
  },
  {
    name: "Puzzle - 1000 Pieces",
    emoji: "🧩",
    image_url: "https://images.unsplash.com/photo-1611996575749-79a3a250f948?w=600&q=80&fit=crop",
    category: "Toys & Games",
    price: 17.99,
    original_price: null,
    rating: 4.5,
    stock: 28,
    badge: "New",
    description: "Unwind and challenge your mind with our 1000-piece jigsaw puzzle. Features a vibrant landscape illustration printed on premium thick cardboard with a linen finish to reduce glare.",
    features: ["1000 pieces", "Premium thick cardboard", "Linen finish (anti-glare)", "Finished size: 27\" × 20\"", "Suitable for ages 12+"],
    reviews: [
      { name: "Zara K.", rating: 5, date: "May 11, 2026", comment: "Wonderful puzzle! The pieces fit together perfectly and the image is gorgeous. Great family activity." },
      { name: "Adam L.", rating: 4, date: "Apr 23, 2026", comment: "Good quality puzzle. Pieces are sturdy and the image is vibrant. Took us a whole weekend — loved it!" }
    ]
  }
];

const force = process.argv.includes('--force');

// Check if image_url column exists (added in later migration)
const cols = db.prepare("PRAGMA table_info(products)").all().map(c => c.name);
const needsMigration = !cols.includes('image_url');

if (needsMigration) {
  console.log('Adding image_url column to products table...');
  db.prepare('ALTER TABLE products ADD COLUMN image_url TEXT').run();
}

// Only seed if table is empty (or --force flag passed)
const count = db.prepare('SELECT COUNT(*) as c FROM products').get().c;
if (count > 0 && !force) {
  // If image_url column was just added, populate it for existing rows
  if (needsMigration) {
    console.log('Migrating existing products with image URLs...');
    // Fall through to update logic below
  } else {
    console.log(`Database already seeded (${count} products). Use --force to re-seed.`);
    process.exit(0);
  }
}

if (count > 0 && force) {
  console.log('Force re-seeding: clearing existing data...');
  db.prepare('DELETE FROM reviews').run();
  db.prepare('DELETE FROM products').run();
  db.prepare('DELETE FROM sqlite_sequence WHERE name IN (?, ?)').run('products', 'reviews');
}

// If we only needed to migrate (column added, data exists), just update image_url values
const currentCount = db.prepare('SELECT COUNT(*) as c FROM products').get().c;
if (currentCount > 0 && needsMigration) {
  const updateImg = db.prepare('UPDATE products SET image_url = ? WHERE name = ?');
  const updateAll = db.transaction(() => {
    for (const p of products) {
      updateImg.run(p.image_url, p.name);
    }
  });
  updateAll();
  console.log(`✅ Migrated image URLs for ${products.length} products.`);
  process.exit(0);
}

const insertProduct = db.prepare(`
  INSERT INTO products (name, emoji, image_url, category, price, original_price, rating, stock, badge, description, features)
  VALUES (@name, @emoji, @image_url, @category, @price, @original_price, @rating, @stock, @badge, @description, @features)
`);

const insertReview = db.prepare(`
  INSERT INTO reviews (product_id, name, rating, date, comment)
  VALUES (@product_id, @name, @rating, @date, @comment)
`);

const seedAll = db.transaction(() => {
  for (const p of products) {
    const { reviews, features, ...productData } = p;
    const result = insertProduct.run({
      ...productData,
      features: JSON.stringify(features)
    });
    const productId = result.lastInsertRowid;
    for (const r of reviews) {
      insertReview.run({ product_id: productId, ...r });
    }
  }
});

seedAll();
console.log(`✅ Seeded ${products.length} products with reviews.`);
