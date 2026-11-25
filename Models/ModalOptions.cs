namespace Nova.Models;

public sealed record ModalOptions(string Id, string Title, string Eyebrow, string Description,
    string ContentPartial, string? FormId = null, string? SubmitText = null);
