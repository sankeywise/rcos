"use client";

type ConfirmDeleteButtonProps = {
  className?: string;
  message?: string;
  children?: React.ReactNode;
};

export default function ConfirmDeleteButton({
  className = "",
  message = "Are you sure you want to delete this training record?",
  children = "Delete Training",
}: ConfirmDeleteButtonProps) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(event) => {
        const confirmed = window.confirm(message);

        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      {children}
    </button>
  );
}