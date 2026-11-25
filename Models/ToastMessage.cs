namespace Nova.Models;

public enum ToastStatus
{
    Success,
    Information,
    Error,
    Warning
}

public sealed record ToastMessage(ToastStatus Status, string Title, string Message, int DurationSeconds = 6);
