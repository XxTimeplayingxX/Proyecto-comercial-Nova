namespace Nova.Dtos;

public sealed record DashboardResumen(decimal SalesTotal, long SalesCount, long ProductsCount, long LowStockCount, long OutOfStockCount);
public sealed record DashboardDia(DateOnly Date, decimal Amount);
public sealed record DashboardProducto(string Id, string Name, decimal Price, string? Category, long Units, decimal Revenue);
public sealed record DashboardVenta(string Id, DateTimeOffset Date, decimal Total, string Status, string Seller);
public sealed record DashboardDto(string Period, DateTimeOffset From, DateTimeOffset To, DateTimeOffset GeneratedAt,
    int Page, DashboardResumen Summary, List<DashboardDia> Daily, List<DashboardProducto> TopProducts,
    List<DashboardVenta> RecentSales, long TotalRows);
public sealed record DashboardLinea(string Name, string? Sku, int Quantity, decimal Price, decimal Subtotal);
public sealed record DashboardVentaDetalle(string Id, DateTimeOffset Date, decimal Total, string Status,
    string Seller, string Customer, List<DashboardLinea> Items);
