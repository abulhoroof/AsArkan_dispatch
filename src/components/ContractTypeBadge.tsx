interface ContractTypeBadgeProps {
  type: "LP GOLD" | "LP PLATINUM" | "LP STANDARD" | "CD GOLD" | "CD PLATINUM" | "OWNER OP." | "D.F.O" | "TRAINING" | "CD C.P.M." | "RENT" | "LP G.NEW" | "LP P.NEW";
}

export const ContractTypeBadge = ({ type }: ContractTypeBadgeProps) => {
  const getStyles = () => {
    switch (type) {
      case "LP GOLD":
      case "LP PLATINUM":
      case "LP STANDARD":
      case "RENT":
      case "LP G.NEW":
      case "LP P.NEW":
        return "bg-amber-700/90 text-white";
      case "CD GOLD":
      case "CD PLATINUM":
      case "CD C.P.M.":
        return "bg-yellow-400/90 text-black";
      case "OWNER OP.":
      case "TRAINING":
        return "bg-cyan-400/80 text-black";
      case "D.F.O":
        return "bg-green-500/90 text-white";
      default:
        return "bg-muted text-foreground";
    }
  };

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getStyles()}`}>
      {type}
    </span>
  );
};
