function calculate(fleet_net_payout) {
    let gross_payout, withholding_tax, calculated_net;
    
    if (fleet_net_payout > 10000) {
        gross_payout = fleet_net_payout / 0.97;
        withholding_tax = gross_payout * 0.03;
    } else {
        gross_payout = fleet_net_payout;
        withholding_tax = 0;
    }

    calculated_net = gross_payout - withholding_tax;

    // Rounding matches production code
    gross_payout = Math.round(gross_payout * 100) / 100;
    withholding_tax = Math.round(withholding_tax * 100) / 100;
    calculated_net = Math.round(calculated_net * 100) / 100;

    return { fleet_net_payout, gross_payout, withholding_tax, calculated_net };
}

console.log("--- Testing Case 1: Net <= 10000 (e.g. 5000) ---");
console.log(calculate(5000));

console.log("\n--- Testing Case 2: Net > 10000 (e.g. 19400) ---");
console.log(calculate(19400));

console.log("\n--- Testing Case 3: Edge Case Net = 10000 ---");
console.log(calculate(10000));

console.log("\n--- Testing Case 4: Net > 10000 (e.g. 10001) ---");
console.log(calculate(10001));
