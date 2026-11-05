
console.log("NOVA COFFEE ADMIN loaded");

// =====================================
// 1. ПОДКЛЮЧЕНИЕ SUPABASE
// =====================================

const SUPABASE_URL = "https://rpvtflsekhaalvxcnzyl.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_8CjKLY9HgZ3yv6TkR0bm4g_RJy-EPe1";

const { createClient } = window.supabase;

const supabaseClient = createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);


// =====================================
// 2. ПОЛУЧАЕМ ЭЛЕМЕНТЫ СТРАНИЦЫ
// =====================================

const loginScreen = document.getElementById("login-screen");
const adminApp = document.getElementById("admin-app");

const loginForm = document.getElementById("login-form");
const loginMessage = document.getElementById("login-message");

const logoutButton = document.getElementById("logout-button");
const adminEmail = document.getElementById("admin-email");

const ordersList = document.getElementById("orders-list");
const productsList = document.getElementById("products-list");

const dashboardMessage = document.getElementById("dashboard-message");

const navButtons = document.querySelectorAll(".nav-button");

let currentUserId = null;
// Все загруженные заказы храним здесь
let allOrders = [];


// =====================================
// 3. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// =====================================

function showMessage(message, isError = false) {
    dashboardMessage.textContent = message;

    dashboardMessage.style.color = isError
        ? "#b5483c"
        : "#64845a";
}

function createElement(tag, className, text = "") {
    const element = document.createElement(tag);

    element.className = className;
    element.textContent = text;

    return element;
}


// =====================================
// 4. АВТОРИЗАЦИЯ
// =====================================

function showLogin(message = "") {
    loginScreen.classList.remove("hidden");
    adminApp.classList.add("hidden");

    loginMessage.textContent = message;
}

async function handleSession(session) {

    if (!session) {
        currentUserId = null;
        showLogin();
        return;
    }

    // Не загружаем данные повторно при том же входе
    if (currentUserId === session.user.id) {
        return;
    }

    currentUserId = session.user.id;

    loginScreen.classList.add("hidden");
    adminApp.classList.remove("hidden");

    adminEmail.textContent = session.user.email || "Администратор";

    await Promise.all([
        loadOrders(),
        loadProducts()
    ]);
}


// Вход по электронной почте и паролю

loginForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    const button = document.getElementById("login-button");

    button.disabled = true;
    button.textContent = "Входим...";

    loginMessage.textContent = "";

    try {

        const { data, error } =
            await supabaseClient.auth.signInWithPassword({
                email,
                password
            });

        if (error) {
            throw error;
        }

        await handleSession(data.session);

    } catch (error) {

        console.error("Ошибка входа:", error);

        loginMessage.textContent =
            "Не удалось войти. Проверь почту и пароль.";

    } finally {

        button.disabled = false;
        button.textContent = "Войти";

    }

});


// Выход из аккаунта

logoutButton.addEventListener("click", async () => {

    const { error } = await supabaseClient.auth.signOut();

    if (error) {
        showMessage("Не удалось выйти из аккаунта.", true);
    }

});


// Следим за изменением авторизации

supabaseClient.auth.onAuthStateChange((_event, session) => {

    // Откладываем работу с базой до завершения callback авторизации
    setTimeout(() => {
        handleSession(session);
    }, 0);

});


// Проверяем, вошёл ли пользователь ранее

async function initializeAdmin() {

    const { data, error } = await supabaseClient.auth.getSession();

    if (error) {
        showLogin("Не удалось проверить авторизацию.");
        return;
    }

    await handleSession(data.session);

}

initializeAdmin();


// =====================================
// 5. ПЕРЕКЛЮЧЕНИЕ РАЗДЕЛОВ
// =====================================

function showView(viewName) {

    document.getElementById("orders-view")
        .classList.toggle("hidden", viewName !== "orders");

    document.getElementById("products-view")
        .classList.toggle("hidden", viewName !== "products");

    navButtons.forEach(button => {

        button.classList.toggle(
            "active",
            button.dataset.view === viewName
        );

    });

    document.getElementById("page-title").textContent =
        viewName === "orders" ? "Заказы" : "Товары";

}

navButtons.forEach(button => {

    button.addEventListener("click", () => {
        showView(button.dataset.view);
    });

});


// =====================================
// 6. ЗАГРУЗКА ЗАКАЗОВ
// =====================================


async function loadOrders() {

    ordersList.textContent = "Загружаем заказы...";

    const { data, error } = await supabaseClient
        .from("orders")
        .select(`
            id,
            total,
            status,
            created_at,
            order_items (
                id,
                product_name,
                quantity,
                unit_price
            )
        `)
        .order("created_at", { ascending: false });

    if (error) {

        console.error("Ошибка загрузки заказов:", error);

        ordersList.textContent =
            "Не удалось загрузить заказы.";

        showMessage("Ошибка загрузки заказов.", true);

        return;
    }

    // Сохраняем полный список заказов
    allOrders = data || [];

    // Отображаем заказы с учётом фильтров
    applyOrderFilters();

}

// =====================================
// ПОИСК И ФИЛЬТРАЦИЯ ЗАКАЗОВ
// =====================================

function applyOrderFilters() {

    const search = document
        .getElementById("order-search")
        .value
        .trim()
        .toLocaleLowerCase("ru");

    const selectedStatus = document
        .getElementById("order-status-filter")
        .value;

    const filteredOrders = allOrders.filter(order => {

        // Проверяем статус
        const matchesStatus =
            selectedStatus === "all" ||
            order.status === selectedStatus;

        // Проверяем номер заказа
        const matchesId = String(order.id).includes(search);

        // Проверяем названия товаров
        const matchesProduct = (order.order_items || []).some(item =>
            item.product_name
                .toLocaleLowerCase("ru")
                .includes(search)
        );

        const matchesSearch =
            search === "" || matchesId || matchesProduct;

        return matchesStatus && matchesSearch;

    });

    renderOrders(filteredOrders);

}


// Реагируем на ввод текста

// ===== УПРАВЛЕНИЕ ПОИСКОМ =====

const orderSearchInput = document.getElementById("order-search");

const clearSearchButton = document.getElementById(
    "clear-order-search"
);

// Показываем крестик только при наличии текста

function updateClearButton() {
    clearSearchButton.classList.toggle(
        "hidden",
        orderSearchInput.value.length === 0
    );
}

// Обработка ввода

orderSearchInput.addEventListener("input", () => {
    updateClearButton();
    applyOrderFilters();
});

// Очистка поиска

clearSearchButton.addEventListener("click", () => {
    orderSearchInput.value = "";

    updateClearButton();
    applyOrderFilters();

    orderSearchInput.focus();
});



// Реагируем на изменение статуса фильтра
document
    .getElementById("order-status-filter")
    .addEventListener("change", applyOrderFilters);


// Сбрасываем фильтры
document
    .getElementById("clear-order-filters")
    .addEventListener("click", () => {

        document.getElementById("order-search").value = "";
        updateClearButton();

        document.getElementById("order-status-filter").value = "all";

        applyOrderFilters();

    });



// =====================================
// 7. ОТОБРАЖЕНИЕ ЗАКАЗОВ
// =====================================


function renderOrders(orders) {

    ordersList.replaceChildren();

    // Статистика рассчитывается по всем заказам,
    // а не только по результатам поиска.

    const newOrders = allOrders.filter(
        order => order.status === "new"
    ).length;

    const activeTotal = allOrders
        .filter(order => order.status !== "cancelled")
        .reduce((sum, order) => sum + Number(order.total), 0);

    document.getElementById("orders-count").textContent =
        allOrders.length;

    document.getElementById("new-orders-count").textContent =
        newOrders;

    document.getElementById("revenue").textContent =
        activeTotal + " сом";

    // Если ничего не найдено

    if (orders.length === 0) {

        ordersList.textContent = allOrders.length === 0
            ? "Заказов пока нет."
            : "По заданным условиям ничего не найдено.";

        return;
    }

    const statusNames = {
        new: "Новый",
        accepted: "Принят",
        completed: "Выполнен",
        cancelled: "Отменён"
    };

    orders.forEach(order => {

        const card = createElement("article", "order-card");

        const header = createElement("div", "order-header");

        const orderInfo = document.createElement("div");

        orderInfo.appendChild(
            createElement("div", "order-number", `Заказ №${order.id}`)
        );

        const date = new Date(order.created_at);

        orderInfo.appendChild(
            createElement(
                "div",
                "order-date",
                date.toLocaleString("ru-RU")
            )
        );

        header.appendChild(orderInfo);

        const itemsContainer = createElement("div", "order-items");

        (order.order_items || []).forEach(item => {

            const row = createElement("div", "order-item");

            const name = createElement(
                "span",
                "",
                `${item.product_name} × ${item.quantity}`
            );

            const price = createElement(
                "strong",
                "",
                `${item.unit_price * item.quantity} сом`
            );

            row.append(name, price);

            itemsContainer.appendChild(row);

        });

        const footer = createElement("div", "order-footer");

        const total = createElement(
            "div",
            "order-total",
            `Итого: ${order.total} сом`
        );

        const status = document.createElement("select");

        status.className = "status-select";

        Object.entries(statusNames).forEach(([value, label]) => {

            const option = document.createElement("option");

            option.value = value;
            option.textContent = label;

            status.appendChild(option);

        });

        status.value = order.status;

        // Изменение статуса заказа

        status.addEventListener("change", async () => {

            const previousStatus = order.status;
            const newStatus = status.value;

            status.disabled = true;

            const { error } = await supabaseClient
                .from("orders")
                .update({ status: newStatus })
                .eq("id", order.id);

            if (error) {

                console.error("Ошибка изменения статуса:", error);

                status.value = previousStatus;

                showMessage(
                    "Не удалось изменить статус заказа.",
                    true
                );

                status.disabled = false;

                return;
            }

            // Обновляем сохранённый список заказов

            allOrders = allOrders.map(item =>

                item.id === order.id
                    ? { ...item, status: newStatus }
                    : item

            );

            showMessage(`Статус заказа №${order.id} обновлён.`);

            // Перестраиваем список и статистику

            applyOrderFilters();

        });

        footer.append(total, status);

        card.append(header, itemsContainer, footer);

        ordersList.appendChild(card);

    });

}


    const statusNames = {
        new: "Новый",
        accepted: "Принят",
        completed: "Выполнен",
        cancelled: "Отменён"
    };

    orders.forEach(order => {

        const card = createElement("article", "order-card");

        const header = createElement("div", "order-header");

        const orderInfo = document.createElement("div");

        orderInfo.appendChild(
            createElement("div", "order-number", `Заказ №${order.id}`)
        );

        const date = new Date(order.created_at);

        orderInfo.appendChild(
            createElement(
                "div",
                "order-date",
                date.toLocaleString("ru-RU")
            )
        );

        header.appendChild(orderInfo);

        const itemsContainer = createElement("div", "order-items");

        (order.order_items || []).forEach(item => {

            const row = createElement("div", "order-item");

            const name = createElement(
                "span",
                "",
                `${item.product_name} × ${item.quantity}`
            );

            const price = createElement(
                "strong",
                "",
                `${item.unit_price * item.quantity} сом`
            );

            row.append(name, price);
            itemsContainer.appendChild(row);

        });

        const footer = createElement("div", "order-footer");

        const total = createElement(
            "div",
            "order-total",
            `Итого: ${order.total} сом`
        );

        const status = document.createElement("select");

        status.className = "status-select";

        Object.entries(statusNames).forEach(([value, label]) => {

            const option = document.createElement("option");

            option.value = value;
            option.textContent = label;

            status.appendChild(option);

        });

        status.value = order.status;

        status.addEventListener("change", async () => {

            const newStatus = status.value;

            status.disabled = true;

            const { error } = await supabaseClient
                .from("orders")
                .update({ status: newStatus })
                .eq("id", order.id);

            if (error) {

                console.error("Ошибка статуса:", error);

                status.value = order.status;

                showMessage(
                    "Не удалось изменить статус. Проверь права доступа.",
                    true
                );

            } else {

                showMessage(`Статус заказа №${order.id} обновлён.`);

                order.status = newStatus;

                // Пересчитываем статистику
                const updatedOrders = orders.map(item =>
                    item.id === order.id
                        ? { ...item, status: newStatus }
                        : item
                );

                renderOrders(updatedOrders);

            }

            status.disabled = false;

        });

        footer.append(total, status);

        card.append(header, itemsContainer, footer);

        ordersList.appendChild(card);

    });




// =====================================
// 8. ЗАГРУЗКА ТОВАРОВ
// =====================================

async function loadProducts() {

    productsList.textContent = "Загружаем товары...";

    const { data, error } = await supabaseClient
        .from("products")
        .select(`
            id,
            name,
            description,
            category,
            price,
            image_url,
            is_available
        `)
        .order("id");

    if (error) {

        console.error("Ошибка товаров:", error);

        productsList.textContent =
            "Не удалось загрузить каталог.";

        showMessage("Ошибка загрузки товаров.", true);

        return;
    }

    renderProducts(data || []);

}


// =====================================
// 9. СОЗДАНИЕ ПОЛЯ ФОРМЫ
// =====================================

function createField(labelText, type, value, fieldName) {

    const wrapper = document.createElement("div");

    const label = document.createElement("label");

    label.textContent = labelText;

    const input = document.createElement(
        type === "textarea" ? "textarea" : "input"
    );

    if (type !== "textarea") {
        input.type = type;
    }

    input.value = value ?? "";
    input.name = fieldName;

    if (fieldName === "price") {
        input.min = "0";
        input.step = "1";
        input.required = true;
    }

    if (fieldName === "name") {
        input.maxLength = 100;
        input.required = true;
    }

    if (fieldName === "description") {
        input.maxLength = 500;
        input.rows = 2;
    }

    wrapper.append(label, input);

    return { wrapper, input };

}


// =====================================
// 10. ОТОБРАЖЕНИЕ ТОВАРОВ
// =====================================

function renderProducts(products) {

    productsList.replaceChildren();

    if (products.length === 0) {
        productsList.textContent = "Товаров пока нет.";
        return;
    }

    products.forEach(product => {

        const card = createElement(
            "article",
            "product-admin-card"
        );

        card.appendChild(
            createElement("h3", "", product.name)
        );

        const nameField = createField(
            "Название",
            "text",
            product.name,
            "name"
        );

        const descriptionField = createField(
            "Описание",
            "textarea",
            product.description,
            "description"
        );

        const categoryWrapper = document.createElement("div");

        const categoryLabel = createElement(
            "label",
            "",
            "Категория"
        );

        const categorySelect = document.createElement("select");

        [
            ["coffee", "Кофе"],
            ["tea", "Чай"],
            ["dessert", "Десерт"]
        ].forEach(([value, label]) => {

            const option = document.createElement("option");

            option.value = value;
            option.textContent = label;

            categorySelect.appendChild(option);

        });

        categorySelect.value = product.category;

        categoryWrapper.append(categoryLabel, categorySelect);

        const priceField = createField(
            "Цена (сом)",
            "number",
            product.price,
            "price"
        );

        const imageField = createField(
            "URL фотографии",
            "url",
            product.image_url,
            "image_url"
        );

        const availableWrapper = document.createElement("label");

        const availableCheckbox = document.createElement("input");

        availableCheckbox.type = "checkbox";
        availableCheckbox.checked = product.is_available;

        availableCheckbox.style.width = "auto";
        availableCheckbox.style.marginRight = "8px";

        availableWrapper.append(
            availableCheckbox,
            document.createTextNode("Товар доступен")
        );

        const actions = createElement("div", "product-actions");

        const saveButton = createElement(
            "button",
            "",
            "Сохранить"
        );

        saveButton.type = "button";

        const deleteButton = createElement(
            "button",
            "delete-button",
            "Удалить"
        );

        deleteButton.type = "button";

        actions.append(saveButton, deleteButton);

        card.append(
            nameField.wrapper,
            descriptionField.wrapper,
            categoryWrapper,
            priceField.wrapper,
            imageField.wrapper,
            availableWrapper,
            actions
        );

        // Сохраняем изменения

        saveButton.addEventListener("click", async () => {

            const newName = nameField.input.value.trim();
            const newPrice = Number(priceField.input.value);
            const newDescription = descriptionField.input.value.trim();

            if (
                !newName ||
                !Number.isSafeInteger(newPrice) ||
                newPrice < 0
            ) {
                showMessage(
                    "Проверь название и цену товара.",
                    true
                );

                return;
            }

            saveButton.disabled = true;
            saveButton.textContent = "Сохраняем...";

            const { error } = await supabaseClient
                .from("products")
                .update({
                    name: newName,
                    description: newDescription,
                    category: categorySelect.value,
                    price: newPrice,
                    image_url: imageField.input.value.trim() || null,
                    is_available: availableCheckbox.checked
                })
                .eq("id", product.id);

            if (error) {

                console.error("Ошибка обновления:", error);

                showMessage(
                    "Не удалось изменить товар. Проверь данные.",
                    true
                );

            } else {

                showMessage(`Товар «${newName}» обновлён.`);

                await loadProducts();

            }

            saveButton.disabled = false;
            saveButton.textContent = "Сохранить";

        });


        // Удаляем товар

        deleteButton.addEventListener("click", async () => {

            const confirmed = confirm(
                `Удалить товар «${product.name}»?`
            );

            if (!confirmed) return;

            deleteButton.disabled = true;

            const { error } = await supabaseClient
                .from("products")
                .delete()
                .eq("id", product.id);

            if (error) {

                console.error("Ошибка удаления:", error);

                showMessage(
                    "Не удалось удалить товар. Возможно, он уже есть в заказах.",
                    true
                );

                deleteButton.disabled = false;

            } else {

                showMessage("Товар удалён.");

                await loadProducts();

            }

        });

        productsList.appendChild(card);

    });

}


// =====================================
// 11. ДОБАВЛЕНИЕ НОВОГО ТОВАРА
// =====================================

const productForm = document.getElementById("product-form");

productForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    const button = document.getElementById("save-product-button");

    const name = document.getElementById("product-name").value.trim();
    const description = document
        .getElementById("product-description").value.trim();

    const category = document.getElementById("product-category").value;

    const price = Number(
        document.getElementById("product-price").value
    );

    const imageUrl = document
        .getElementById("product-image").value.trim();

    if (
        !name ||
        !Number.isSafeInteger(price) ||
        price < 0
    ) {

        showMessage("Проверь название и цену.", true);
        return;

    }

    button.disabled = true;
    button.textContent = "Добавляем...";

    const { error } = await supabaseClient
        .from("products")
        .insert({
            name,
            description,
            category,
            price,
            image_url: imageUrl || null,
            is_available: true
        });

    if (error) {

        console.error("Ошибка добавления:", error);

        showMessage(
            "Не удалось добавить товар. Проверь данные и права доступа.",
            true
        );

    } else {

        productForm.reset();

        showMessage(`Товар «${name}» успешно добавлен.`);

        await loadProducts();

    }

    button.disabled = false;
    button.textContent = "Добавить товар";

});


// =====================================
// 12. КНОПКИ ОБНОВЛЕНИЯ
// =====================================

document
    .getElementById("refresh-orders")
    .addEventListener("click", loadOrders);

document
    .getElementById("refresh-products")
    .addEventListener("click", loadProducts);
