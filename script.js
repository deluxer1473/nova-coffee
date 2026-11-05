
console.log("NOVA COFFEE website loaded!");

// ===== ТОВАРЫ =====


// ===== ПОДКЛЮЧЕНИЕ SUPABASE =====

// Вставь сюда Project URL из Supabase
const SUPABASE_URL = "https://rpvtflsekhaalvxcnzyl.supabase.co";

// Вставь сюда Publishable key
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_8CjKLY9HgZ3yv6TkR0bm4g_RJy-EPe1";

// Создаём подключение
const { createClient } = window.supabase;

const supabaseClient = createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

// Товары теперь загружаются из базы данных
let products = [];

// ===== КОРЗИНА =====


// ===== СОХРАНЕНИЕ КОРЗИНЫ =====

const CART_STORAGE_KEY = "nova-coffee-cart";

// Загружаем корзину из памяти браузера
function loadCart() {
    try {
        const savedCart = localStorage.getItem(CART_STORAGE_KEY);

        if (!savedCart) {
            return [];
        }

        const parsedCart = JSON.parse(savedCart);

        if (!Array.isArray(parsedCart)) {
            return [];
        }

        // Проверяем корректность сохранённых товаров
        return parsedCart.filter(item =>
            item &&
            Number.isInteger(item.id) &&
            Number.isInteger(item.quantity) &&
            item.quantity > 0 &&
            products.some(product => product.id === item.id)
        );

    } catch (error) {
        console.error("Ошибка загрузки корзины:", error);
        return [];
    }
}

// Записываем корзину в память браузера
function saveCart() {
    try {
        localStorage.setItem(
            CART_STORAGE_KEY,
            JSON.stringify(cart)
        );
    } catch (error) {
        console.error("Ошибка сохранения корзины:", error);
    }
}

// Загружаем сохранённые товары при запуске
let cart = [];


// ===== ПОКАЗ ТОВАРОВ =====

const productList = document.getElementById("product-list");

// ===== СОЗДАНИЕ УВЕДОМЛЕНИЯ =====

const toast = document.createElement("div");

toast.className = "cart-toast";
toast.setAttribute("role", "status");
toast.setAttribute("aria-live", "polite");

document.body.appendChild(toast);

let toastTimer;

function showToast(productName) {
    toast.textContent = `✓ ${productName} добавлен в корзину`;

    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 2500);
}

function renderProducts(category = "all") {

    const filteredProducts = category === "all"
        ? products
        : products.filter(product => product.category === category);

    productList.innerHTML = "";

    filteredProducts.forEach(product => {

        const card = document.createElement("article");

        card.className = "product-card";

        const image = document.createElement("div");
        image.className = "coffee-image";
        image.style.backgroundImage = `url("${product.image_url || ""}")`;

        const name = document.createElement("h3");
        name.textContent = product.name;

        const description = document.createElement("p");
        description.textContent = product.description;

        const price = document.createElement("strong");
        price.className = "product-price";
        price.textContent = product.price + " сом";

        const button = document.createElement("button");
        button.className = "add-button";
        button.textContent = "Добавить в корзину";

        button.addEventListener("click", () => {
    addToCart(product.id, button);
});

        card.append(image, name, description, price, button);

        productList.appendChild(card);
    });
}

// ===== ПЕРЕКЛЮЧЕНИЕ КАТЕГОРИЙ =====

const categoryButtons = document.querySelectorAll(".category");

categoryButtons.forEach(button => {

    button.addEventListener("click", () => {

        categoryButtons.forEach(item => {
            item.classList.remove("active");
        });

        button.classList.add("active");

        renderProducts(button.dataset.category);
    });

});

// ===== ДОБАВЛЕНИЕ В КОРЗИНУ =====


function addToCart(productId, button) {

    const existingItem = cart.find(item => item.id === productId);

    if (existingItem) {
        existingItem.quantity++;
    } else {
        cart.push({
            id: productId,
            quantity: 1
        });
    }

    saveCart();
renderCart();

    // Показываем уведомление
    const product = products.find(p => p.id === productId);
    showToast(product.name);

    // Меняем текст кнопки
    const originalText = button.textContent;

    button.textContent = "Добавлено ✓";
    button.classList.add("added");
    button.disabled = true;

    setTimeout(() => {
        button.textContent = originalText;
        button.classList.remove("added");
        button.disabled = false;
    }, 900);
}


// ===== УПРАВЛЕНИЕ КОЛИЧЕСТВОМ =====

function changeQuantity(productId, amount) {

    const item = cart.find(item => item.id === productId);

    if (!item) return;

    item.quantity += amount;

    if (item.quantity <= 0) {
        cart = cart.filter(item => item.id !== productId);
    }

    saveCart();
renderCart();
}

// ===== ОТОБРАЖЕНИЕ КОРЗИНЫ =====

function renderCart() {

    const cartItems = document.getElementById("cart-items");
    const cartTotal = document.getElementById("cart-total");
    const orderButton = document.getElementById("order-button");

    cartItems.innerHTML = "";

    if (cart.length === 0) {
        cartItems.textContent = "Корзина пока пуста";
    }

    let total = 0;

    cart.forEach(item => {

        const product = products.find(p => p.id === item.id);

        if (!product) return;

        total += product.price * item.quantity;

        const row = document.createElement("div");
        row.className = "cart-item";

        const info = document.createElement("div");
        info.className = "cart-item-info";

        const name = document.createElement("strong");
        name.textContent = product.name;

        const price = document.createElement("p");
        price.textContent = product.price + " сом за штуку";

        info.append(name, price);

        const controls = document.createElement("div");
        controls.className = "cart-controls";

        const minus = document.createElement("button");
        minus.textContent = "−";
        minus.setAttribute("aria-label", "Уменьшить количество");
        minus.addEventListener("click", () => {
            changeQuantity(item.id, -1);
        });

        const quantity = document.createElement("span");
        quantity.textContent = item.quantity;

        const plus = document.createElement("button");
        plus.textContent = "+";
        plus.setAttribute("aria-label", "Увеличить количество");
        plus.addEventListener("click", () => {
            changeQuantity(item.id, 1);
        });

        controls.append(minus, quantity, plus);
        row.append(info, controls);

        cartItems.appendChild(row);
    });

    cartTotal.textContent = total + " сом";

    orderButton.disabled = cart.length === 0;
}

// ===== ОФОРМЛЕНИЕ ЗАКАЗА =====


// ===== НАСТОЯЩЕЕ ОФОРМЛЕНИЕ ЗАКАЗА =====

async function submitOrder() {

    const orderButton = document.getElementById("order-button");

    if (cart.length === 0) {
        return;
    }

    const originalText = orderButton.textContent;

    // Блокируем кнопку во время отправки
    orderButton.disabled = true;
    orderButton.textContent = "Отправляем заказ...";

    // Передаём только ID товаров и количество.
    // Цены самостоятельно проверит база данных.

    const items = cart.map(item => ({
        id: item.id,
        quantity: item.quantity
    }));

    try {

        const { data, error } = await supabaseClient.rpc(
            "create_order",
            {
                p_items: items
            }
        );

        if (error) {
            throw error;
        }

        // Очищаем корзину только после успешной записи
        cart = [];

        saveCart();
        renderCart();

        orderButton.textContent = originalText;

        alert(
            `Заказ №${data.order_id} успешно создан!\n` +
            `Сумма: ${data.total} сом`
        );

        console.log("Создан заказ:", data);

    } catch (error) {

        console.error("Ошибка оформления заказа:", error);

        alert(
            "Не удалось оформить заказ. " +
            "Проверь подключение и попробуй ещё раз."
        );

        orderButton.disabled = false;
        orderButton.textContent = originalText;
    }
}

// Подключаем обработчик кнопки

document
    .getElementById("order-button")
    .addEventListener("click", submitOrder);


// ===== ЗАПУСК =====



// ===== ЗАГРУЗКА ТОВАРОВ ИЗ SUPABASE =====

async function loadProductsFromSupabase() {

    productList.textContent = "Загружаем меню...";

    const { data, error } = await supabaseClient
        .from("products")
        .select("id, name, description, category, price, image_url")
        .eq("is_available", true)
        .order("id", { ascending: true });

    // Проверяем ошибки
    if (error) {
        console.error("Ошибка Supabase:", error);

        productList.textContent =
            "Не удалось загрузить меню. Проверь подключение.";

        return;
    }

    // Получаем товары
    products = data || [];

    // Восстанавливаем сохранённую корзину
    cart = loadCart();

    // Обновляем сайт
    renderProducts();
    renderCart();

    console.log("Товары успешно загружены:", products);
}

// Запускаем загрузку
loadProductsFromSupabase();
