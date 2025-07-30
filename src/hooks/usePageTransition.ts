import { useNavigate } from 'react-router-dom';
import { useRouteAnimation } from '../components/transitions/RouteAnimationProvider';

interface TransitionOptions {
  type?: 'slide' | 'fade' | 'scale' | 'slideUp';
  duration?: number;
  delay?: number;
}

export const usePageTransition = () => {
  const navigate = useNavigate();
  const { setAnimating } = useRouteAnimation();

  const navigateWithTransition = (
    to: string, 
    options: TransitionOptions = {}
  ) => {
    const { delay = 0 } = options;
    
    setAnimating(true);
    
    if (delay > 0) {
      setTimeout(() => {
        navigate(to);
      }, delay);
    } else {
      navigate(to);
    }
  };

  return { navigateWithTransition };
};