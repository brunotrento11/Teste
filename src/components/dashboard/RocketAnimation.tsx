export const RocketAnimation = () => {
  return (
    <div className="relative w-16 h-16 mx-auto">
      <div className="absolute inset-0 animate-[float_3s_ease-in-out_infinite]">
        {/* Corpo do foguete */}
        <div className="w-12 h-16 mx-auto bg-gradient-to-b from-primary to-primary/80 rounded-t-full relative">
          {/* Janela */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-background/30 rounded-full border-2 border-background/50" />
          
          {/* Asas */}
          <div className="absolute bottom-0 left-0 w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-primary/60 border-b-[16px] border-b-primary/60 -translate-x-full" />
          <div className="absolute bottom-0 right-0 w-0 h-0 border-l-[12px] border-l-primary/60 border-r-[12px] border-r-transparent border-b-[16px] border-b-primary/60 translate-x-full" />
        </div>
        
        {/* Chama do propulsor */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-8 -translate-y-2">
          <div className="absolute inset-0 bg-gradient-to-b from-orange-500 via-red-500 to-yellow-500 rounded-b-full animate-[flicker_0.3s_ease-in-out_infinite] opacity-90" />
          <div className="absolute inset-0 bg-gradient-to-b from-yellow-400 to-transparent rounded-b-full animate-[flicker_0.2s_ease-in-out_infinite] opacity-70" />
        </div>
      </div>
      
      {/* Estrelas decorativas */}
      <div className="absolute -top-2 -left-2 text-yellow-400 animate-pulse">✨</div>
      <div className="absolute -top-4 -right-1 text-yellow-400 animate-pulse" style={{ animationDelay: '0.5s' }}>⭐</div>
    </div>
  );
};