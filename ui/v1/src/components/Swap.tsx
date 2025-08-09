import type {FC, ReactNode} from "react";

export interface SwapProps {
    isActive: boolean;
    activeNode: ReactNode;
    inactiveNode: ReactNode;
    onChange?: (isActive: boolean) => void;
    className?: string
}

const Swap: FC<SwapProps> = ({isActive, activeNode, inactiveNode, onChange, className}) => {
    return (
        <div onClick={() => {
            if (onChange) {
                onChange(!isActive);
            }
        }}
             className={className}
        >
            {isActive ? activeNode : inactiveNode}
        </div>
    )
}

export default Swap;
