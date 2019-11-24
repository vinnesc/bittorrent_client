# BitTorrent Client
This is a little toy project started to get more familiar with Nodejs.  
Idea: https://allenkim67.github.io/programming/2016/05/04/how-to-make-your-own-bittorrent-client.html  
Reference: http://www.bittorrent.org/beps/bep_0000.html  

# Features  
1. It actually works (only with UDP trackers). The tutorial I linked at the beginning doesn't work because a dependency is broken and there are bugs in the code. My version works fine.  
2. Attempts to connect to every possible tracker listed on the torrent.  
3. Checks initial connection with the tracker is correct.  
4. Only depends on 1 non-standard library.  

# Screenshots
![Download process](https://i.imgur.com/CAx624f.png)
![Peers listing](https://i.imgur.com/frp2EGl.png)

# Possible TODOs  
1. Retry every lost UDP packet.  
2. Optimize download process.  
3. Add support for multiple downloads.  
4. Pause/resume.  
5. Support HTTP/HTTPS trackers.
