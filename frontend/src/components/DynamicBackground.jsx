import { motion } from 'framer-motion';

export default function DynamicBackground({ imageUrl }) {
  // A dark default if no image is playing
  const bgImage = imageUrl || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop";

  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-black">
      {/* 
        The slow parallax/zoom effect requested by the user. 
        It scales up and down slightly, with a subtle rotation to feel 'alive'.
      */}
      <motion.div 
        className="absolute inset-[-10%] w-[120%] h-[120%] bg-cover bg-center opacity-30 blur-[100px] saturate-[1.5]"
        style={{ backgroundImage: `url(${bgImage})` }}
        animate={{
          scale: [1, 1.05, 1],
          rotate: [0, 1, -1, 0]
        }}
        transition={{
          duration: 30,
          repeat: Infinity,
          ease: "linear"
        }}
      />
      {/* Gradient overlays to maintain text contrast and add depth */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/80 mix-blend-multiply" />
      <div className="absolute inset-0 bg-black/20" />
    </div>
  );
}
