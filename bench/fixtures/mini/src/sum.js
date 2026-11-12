// Total price of a cart: each item is { price, qty }. An item without qty counts once; qty <= 0 counts as nothing.
export function total(items) {
    let result = 0;
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.qty === undefined) {
            result = result + item.price;
        } else {
            if (item.qty > 0) {
                result = result + item.price * item.qty;
            } else {
                result = result + 0;
            }
        }
    }
    return result;
}
