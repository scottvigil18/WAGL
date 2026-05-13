# Requirements Document

## Introduction

This feature adds a "You might also like" recommendations section to the product detail page. When a user views a product, the section displays a curated list of related products from the same category, excluding the currently viewed product. The goal is to increase product discovery and encourage users to explore more of the catalog.

The feature spans the full stack: a new backend API endpoint queries the database for same-category products, and the frontend renders a horizontally scrollable or grid-based recommendations strip below the main product detail and above the reviews section.

## Glossary

- **Recommendation_Section**: The "You might also like" UI section rendered on the product detail page.
- **Recommended_Product**: A product returned by the recommendations API that shares the same category as the currently viewed product, excluding the current product itself.
- **Recommendations_API**: The backend endpoint `GET /api/products/:id/recommendations` that returns Recommended_Products.
- **Product_Page**: The frontend page component (`ProductPage.jsx`) that displays a single product's details.
- **Product_Card**: A compact UI card displaying a Recommended_Product's emoji, name, price, and star rating, which links to that product's detail page.
- **Category**: The product classification string stored in the `category` column of the `products` table (e.g., "Electronics", "Clothing").

---

## Requirements

### Requirement 1: Recommendations API Endpoint

**User Story:** As a backend service, I want to expose a recommendations endpoint, so that the frontend can retrieve related products for any given product.

#### Acceptance Criteria

1. THE Recommendations_API SHALL accept a valid integer product ID as a path parameter.
2. WHEN a valid product ID is provided, THE Recommendations_API SHALL return up to 8 Recommended_Products from the same Category as the requested product, excluding the requested product itself.
3. WHEN a valid product ID is provided, THE Recommendations_API SHALL return each Recommended_Product with at minimum the following fields: `id`, `name`, `emoji`, `price`, `original_price`, `rating`, `category`, and `badge`.
4. WHEN a valid product ID is provided and fewer than 8 products share the same Category, THE Recommendations_API SHALL return all available Recommended_Products without error.
5. WHEN a valid product ID is provided and no other products share the same Category, THE Recommendations_API SHALL return an empty array.
6. IF a non-integer or missing product ID is provided, THEN THE Recommendations_API SHALL return HTTP 400 with a JSON error message.
7. IF the requested product ID does not exist in the database, THEN THE Recommendations_API SHALL return HTTP 404 with a JSON error message.
8. WHEN the database query fails, THE Recommendations_API SHALL return HTTP 500 with a JSON error message.

---

### Requirement 2: Frontend API Integration

**User Story:** As a frontend developer, I want a dedicated API function for fetching recommendations, so that the Product_Page can retrieve related products cleanly and consistently.

#### Acceptance Criteria

1. THE Recommendations_API client function SHALL accept a product ID and return a promise that resolves to an array of Recommended_Products.
2. WHEN the Recommendations_API returns a non-OK HTTP response, THE Recommendations_API client function SHALL throw an error.
3. THE Recommendations_API client function SHALL use a relative path (`/api/products/:id/recommendations`) so that the Vite proxy routes it correctly in development.

---

### Requirement 3: Recommendation Section Display

**User Story:** As a shopper, I want to see related products when viewing a product, so that I can discover other items I might be interested in.

#### Acceptance Criteria

1. WHEN a product page loads and the Recommendations_API returns one or more Recommended_Products, THE Recommendation_Section SHALL be rendered below the main product detail grid and above the reviews section.
2. WHEN the Recommendations_API returns an empty array, THE Recommendation_Section SHALL not be rendered.
3. THE Recommendation_Section SHALL display the heading "You might also like".
4. THE Recommendation_Section SHALL render a Product_Card for each Recommended_Product returned by the Recommendations_API.
5. WHILE recommendations are loading, THE Recommendation_Section SHALL display a loading skeleton in place of Product_Cards.
6. IF the Recommendations_API call fails, THEN THE Recommendation_Section SHALL not be rendered and SHALL not display an error message to the user.

---

### Requirement 4: Product Card Content and Navigation

**User Story:** As a shopper, I want each recommended product card to show key details and be clickable, so that I can quickly evaluate and navigate to products I find interesting.

#### Acceptance Criteria

1. THE Product_Card SHALL display the Recommended_Product's emoji, name, price, and star rating.
2. WHERE a Recommended_Product has an `original_price` greater than its `price`, THE Product_Card SHALL display the original price with a strikethrough and the discount percentage.
3. WHERE a Recommended_Product has a `badge` value, THE Product_Card SHALL display the badge label.
4. WHEN a shopper clicks a Product_Card, THE Product_Page SHALL navigate to the detail page of the selected Recommended_Product.
5. WHEN a shopper navigates to a Recommended_Product via a Product_Card, THE Recommendation_Section SHALL reload and display products related to the newly viewed product.

---

### Requirement 5: Accessibility

**User Story:** As a shopper using assistive technology, I want the recommendations section to be navigable and understandable, so that I have the same browsing experience as other users.

#### Acceptance Criteria

1. THE Recommendation_Section SHALL be wrapped in a `<section>` element with an `aria-label` of "You might also like".
2. THE Product_Card SHALL be rendered as or contain a focusable, keyboard-navigable element so that keyboard users can activate it.
3. THE Product_Card SHALL provide an accessible name that includes the Recommended_Product's name (e.g., via `aria-label` or visible text).
