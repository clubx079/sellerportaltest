'use client';

import { motion } from 'framer-motion';

const StatusCard = ({ title, value, icon: Icon }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/80 backdrop-blur-xl rounded-2xl border border-neutral-200/60 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-neutral-500">{title}</p>
          <p className="text-2xl font-semibold tracking-tight text-neutral-900 mt-2">{value}</p>
        </div>
        <div className="w-12 h-12 rounded-xl bg-neutral-100 flex items-center justify-center">
          <Icon className="w-5 h-5 text-neutral-900" />
        </div>
      </div>
    </motion.div>
  );
};

export default StatusCard;
