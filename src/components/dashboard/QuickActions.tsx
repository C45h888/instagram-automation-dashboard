import React from 'react';
import { Plus, Calendar, BarChart3, Settings } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../hooks/useToast';
import { useModal } from '../../hooks/useModal';
import LoadingButton from '../ui/LoadingButton';

const QuickActions: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const modal = useModal();
  const [loadingStates, setLoadingStates] = React.useState<Record<string, boolean>>({});

  const actions = [
    {
      label: 'Create Post',
      icon: <Plus className="w-5 h-5" />,
      onClick: async () => {
        setLoadingStates(prev => ({ ...prev, create: true }));
        const confirmed = await modal.openConfirm({
          title: 'Create New Post',
          message: 'This will open the content creation interface. Continue?',
          variant: 'info',
          confirmText: 'Create Post'
        });
        
        if (confirmed) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
          navigate('/content');
          toast.success('Opening content creator...', {
            title: 'Navigation'
          });
        }
        setLoadingStates(prev => ({ ...prev, create: false }));
      },
      gradient: 'from-blue-500 to-purple-600',
      description: 'Create new content'
    },
    {
      label: 'Schedule Content',
      icon: <Calendar className="w-5 h-5" />,
      onClick: () => {
        setLoadingStates(prev => ({ ...prev, schedule: true }));
        setTimeout(() => {
          setLoadingStates(prev => ({ ...prev, schedule: false }));
          navigate('/content');
          toast.info('Content scheduler loaded', {
            title: 'Scheduler',
            duration: 3000
          });
        }, 800);
      },
      gradient: 'from-green-500 to-teal-600',
      description: 'Plan your posts'
    },
    {
      label: 'View Analytics',
      icon: <BarChart3 className="w-5 h-5" />,
      onClick: () => {
        setLoadingStates(prev => ({ ...prev, analytics: true }));
        setTimeout(() => {
          setLoadingStates(prev => ({ ...prev, analytics: false }));
          navigate('/analytics');
          toast.info('Loading analytics dashboard...', {
            title: 'Analytics'
          });
        }, 600);
      },
      gradient: 'from-orange-500 to-red-600',
      description: 'Track performance'
    },
    {
      label: 'Settings',
      icon: <Settings className="w-5 h-5" />,
      onClick: () => {
        setLoadingStates(prev => ({ ...prev, settings: true }));
        setTimeout(() => {
          setLoadingStates(prev => ({ ...prev, settings: false }));
          navigate('/settings');
          toast.info('Opening settings panel', {
            title: 'Settings'
          });
        }, 400);
      },
      gradient: 'from-gray-500 to-gray-700',
      description: 'Configure automation'
    }
  ];

  return (
    <motion.div 
      className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, staggerChildren: 0.1 }}
    >
      {actions.map((action, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: index * 0.1 }}
        >
          <LoadingButton
            loading={loadingStates[action.label.toLowerCase().replace(' ', '')]}
            onClick={action.onClick}
            variant="primary"
            className={`group p-6 rounded-xl bg-gradient-to-r ${action.gradient} text-white font-medium shadow-lg w-full h-full`}
          >
            <div className="flex flex-col items-center text-center space-y-2">
              <motion.div 
                className="p-2 rounded-lg bg-white/20 group-hover:bg-white/30 transition-colors"
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ duration: 0.2 }}
              >
                {action.icon}
              </motion.div>
              <div>
                <div className="font-semibold">{action.label}</div>
                <div className="text-xs opacity-80">{action.description}</div>
              </div>
            </div>
          </LoadingButton>
        </motion.div>
      ))}
    </motion.div>
  );
};

export default QuickActions;