import Image from "next/image";

export function Timmy({
  className = "",
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      className={className}
      src="/timmy.png"
      alt="Timmy, la mascotte di Timmy Timer"
      width={1236}
      height={1272}
      priority={priority}
    />
  );
}
