# ShopMart — Product Overview

ShopMart is a 3-tier e-commerce web application. It allows users to browse products, view product details with reviews, manage a shopping cart, and proceed to checkout.

## Core Features

- **Product catalog** — grid view with search, category filter, and sort (price/name)
- **Product detail** — description, features list, stock indicator, star ratings, reviews, quantity selector, add-to-cart
- **Shopping cart** — session-based cart with quantity controls, item removal, order summary, and checkout

## User Flow

1. Browse products on the home page
2. Click a product to view its detail page
3. Add items to cart (quantity selectable)
4. Review and manage cart, then checkout

## Session Model

Cart state is tied to a browser session ID stored in `localStorage` (`shopmart_session_id`). No user authentication exists — carts are anonymous and session-scoped.
