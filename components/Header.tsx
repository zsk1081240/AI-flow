
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';

interface HeaderProps {
    isDarkMode: boolean;
    toggleDarkMode: () => void;
}

const Header: React.FC<HeaderProps> = ({ isDarkMode, toggleDarkMode }) => {
  return (
    <header className="bg-ai-dark/80 backdrop-blur-md p-4 relative flex justify-between items-center border-b border-ai-border z-20 h-16">
      {/* Left side spacer to balance the flex layout */}
      <div className="w-10"></div> 

      {/* Center Title & Icon */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-4">
          {/* HZ Icon (Ref 1 Style with Enhanced Backlight) */}
          <div className="relative group cursor-default">
            {/* Strong Backlight / Glow Effect */}
            <div className="absolute -inset-2 bg-gradient-to-r from-indigo-500 to-ai-accent rounded-xl blur-lg opacity-50 group-hover:opacity-80 transition duration-500 animate-pulse-slow"></div>
            
            {/* Main Icon Container */}
            <div className="relative h-10 w-10 bg-gradient-to-br from-indigo-600 via-ai-accent to-purple-700 rounded-xl flex items-center justify-center shadow-2xl ring-1 ring-white/20 group-hover:scale-105 transition-transform duration-300">
                {/* Gloss/Highlight overlay */}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>
                <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent rounded-t-xl pointer-events-none"></div>
                
                {/* Text */}
                <span className="text-white font-black text-sm tracking-tighter drop-shadow-md select-none relative z-10">HZ</span>
            </div>
          </div>

          {/* Title Text - Standard Sans-Serif (Clean & Modern) */}
          <h1 className="text-lg font-bold text-white tracking-wide font-sans select-none drop-shadow-sm">
              HZ-AI Studio
          </h1>
      </div>

      {/* Right side controls */}
      <div className="flex items-center gap-3">
        {/* About button removed */}
      </div>
    </header>
  );
};

export default Header;